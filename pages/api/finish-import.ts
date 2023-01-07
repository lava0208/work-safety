import type { NextApiRequest, NextApiResponse } from 'next'
import { Payloads, Defaults, ILocation, coerceString, coerceNumber, tokenizeBiz, tokenizeString, openCSVBlob, generateOshaFieldMaps, IIndustry, Query, UUID, Logger, ID, generateCharCount, ICompany, METRIC_NAMES, calcTrir, getId, IBiz, calcDart, flattenBusinesses, IBiz_Flattened as IBiz_Flat, getNAICSInfo, OSHA_FIELDS, Metric, calcWsiScore, IIndustryInfo, calcAvgWorkWeek, getRevalidateUrls } from '../../utils/wsi';
import { getLocationsContainer, getCompaniesContainer, getErrorsContainer, getIndustryInfoContainer } from '../../utils/db-server';
import fsm from 'fuzzy-string-matching';
import { OperationInput, OperationResponse } from '@azure/cosmos';
import { isAdmin } from './login';

const FIRST_ALPHA_REGEX = /[a-z]/i;
const CO_NAME_SIMILARITY_THRESHOLD = 0.9;
const NUM_YEARS_BACK = 20; //How many years back to look for locations (for calculating running averages, etc.)
const MAX_CONCURRENT_ROWS = 20;
let NUM_BATCH_SAVE = 60; //Number of processed rows to batch together in a single DB write. Max of 100. But that caused some 429 codes: https://learn.microsoft.com/en-us/azure/cosmos-db/nosql/troubleshoot-request-rate-too-large?tabs=resource-specific.

const METRICS_EXCLUDED_INCIDENTS: Metric[] = ['trir', 'dart', 'total_dafw_cases', 'total_dafw_days', 'total_djtr_cases', 'total_djtr_days'];

const _inProgress: { [nonce: ID]: IProgress } = {}; //Tracks progress (0 - 1 scale)

/**
 * Finish importing data file to DB
 * @param req POST. Body: Payloads.IFinishImport
 * @param res IProgress
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (!(await isAdmin(req, res))) {
        return res.status(403).end();
    }

    if (req.method == 'POST') {
        const payload = JSON.parse(req.body) as Payloads.IFinishImport;

        if (payload.nonce) {
            if (_inProgress[payload.nonce]) {
                const progress = _inProgress[payload.nonce];

                if (progress.revalidateUrls.length > 0 && progress.completedTasks == progress.totalTasks) {
                    //I wish there were a better place to do this, but we need a NextApiResponse object, so it has to happen in context of a web request
                    for (const url of progress.revalidateUrls) {
                        res.revalidate(url);
                    }
                }

                return res.status(200).json(progress);
            } else {
                return res.status(204).end();
            }
        }

        let data: IBiz_Flat[] | undefined = undefined;

        if (payload.locs) {
            data = flattenBusinesses(payload.locs);
        }

        if (!data && payload.filename) {
            data = await openCSVBlob(payload.filename!);
            if (data.length == 0) {
                console.error(`Error importing: No rows`);
                return res.status(500).end();
            }
        }

        let progress = await beginJsonImport(data!, { filename: payload.filename, skipLocations: payload.skipLocations });
        _inProgress[progress.nonce] = progress;
        return res.status(200).json(progress);
    }
}

export async function beginJsonImport(locs: IBiz_Flat[], ops?: IProcessingData['ops']): Promise<IProgress> {
    const logger = new Logger();

    logger.log(`Beginning import`);
    if (ops?.skipLocations) {
        logger.log(`Skipping locations`);
    }

    let progress: IProgress = {
        filename: ops?.filename || '',
        locs: [],
        nonce: UUID(),
        task: 'Initializing',
        totalTasks: locs.length,
        completedTasks: 0,
        skipLocations: ops?.skipLocations || false,
        revalidateUrls: [],
    };

    if (locs.length < 50) {
        for (let loc of locs) {
            for (let url of getRevalidateUrls(loc)) {
                progress.revalidateUrls.push(url);
            }
        }
    }

    progress.task = 'Populating missing company_name\'s';
    for (let i = 0; i < locs.length; i++) {
        const loc = locs[i];
        if (loc.establishment_name && (
            !loc.company_name
            || loc.company_name.match(FIRST_ALPHA_REGEX)?.length == 0)
        ) {
            loc.company_name = loc.establishment_name;
        }

        loc.company_name = (loc.company_name || '').trim();
    }

    progress.task = 'Sorting records';
    logger.log(`Sorting ${locs.length} rows`);
    locs.sort((a, b) => { //Sort by company_name so all locations for a company are "grouped" together
        if (a.company_name! > b.company_name!) {
            return 1;
        } else if (b.company_name! > a.company_name!) {
            return -1;
        } else {
            return 0;
        }
    });
    logger.log('Finished sorting');

    progress.task = 'Loading NAICS codes';
    logger.log('Finished getting static resources and map');

    const processingData: IProcessingData = {
        ops: ops || {},
        maps: await generateOshaFieldMaps(locs),
        yearsRepresented: [],
    
        locs: locs,
        locsToUpload: [],
        numLocsParsed: 0,
        numLocsUploaded: 0,
        numLocErrors: 0,
        locPatchOps: [],
        
        companyMap: {},
        companyNameMap: {},
        companyNames: [],
        companiesToUpload: [],
        numCompaniesParsed: 0,
        numCompaniesUploaded: 0,
        numCompaniesErrors: 0,
        companyPatchOps: [],
        
        industryMap: {},
        errors: [],
    
        progress,
        logger,
    };

    progress.task = 'Processing locations';

    const locationProms: Promise<void>[] = [];
    for (let i = 0; i < MAX_CONCURRENT_ROWS; i++) {
        locationProms.push(beginLocationChain(processingData));
    }
    if (!ops?.skipLocations) {
        locationProms.push(beginLocationUploads(processingData));
    }
    
    //Don't use await here. We want the web request to return immediately while this continues processing
    Promise.all(locationProms)
    .then(async () => {
        progress.task = 'Processing companies';

        logger.log(`Processing ${processingData.companyNames.length} companies`);
        const companyProms: Promise<void>[] = [];
        for (let i = 0; i < MAX_CONCURRENT_ROWS; i++) {
            companyProms.push(beginCompanyChain(processingData));
        }
        companyProms.push(beginCompanyUploads(processingData));

        await Promise.all(companyProms);
        await beginIndustryUploads(processingData);
        await beginErrorUploads(processingData);
        
        logger.end('Done!');
        progress.task = 'Done!';

        setTimeout(() => {
            delete _inProgress[progress.nonce];
        }, 10000); //Give the client a chance to poll our status before cleaning up
    });

    return progress;
}

async function beginLocationChain(data: IProcessingData) {    
    while (data.numLocsParsed < data.locs.length) {
        await processLocation(data, data.numLocsParsed++);
    }
}

async function processLocation(data: IProcessingData, idx: number): Promise<void> {
    return new Promise<void>(async (resolve, reject) => {
        let curCol: keyof ILocation | keyof NonNullable<ILocation['industry']> | keyof NonNullable<ILocation['archive']> | null = null; //Used for tracking which field we erred on
        try {
            const row = data.locs[idx];
            const newLoc = Defaults.ILocation();
    
            curCol = 'naics_code';
            const industry: IIndustry = {
                naics_code: data.maps.industry.naics_code ? coerceNumber(row[data.maps.industry.naics_code]) : undefined,
                caption: data.maps.industry.industry_description ? coerceString(row[data.maps.industry.industry_description]) : undefined,
            };
            if (industry.naics_code && !industry.caption) {
                const info = await getNAICSInfo(industry.naics_code);
                if (info.length > 0) {
                    industry.caption = info[0].caption;
                }
            }
            if (industry.naics_code || industry.caption) {
                newLoc.industry = industry;
            }

            curCol = 'ein';
            newLoc.ein = data.maps.main.ein ? coerceString(row[data.maps.main.ein]) : undefined;
            curCol = 'year_filing_for';
            newLoc.year_filing_for = (data.maps.main.year_filing_for ? coerceNumber(row[data.maps.main.year_filing_for]) : undefined) || newLoc.year_filing_for;
            if (!data.yearsRepresented.includes(newLoc.year_filing_for)) {
                data.yearsRepresented.push(newLoc.year_filing_for);
            }
            curCol = 'establishment_name';
            newLoc.establishment_name = data.maps.main.establishment_name ? coerceString(row[data.maps.main.establishment_name]) : undefined;
            curCol = 'company_name';
            newLoc.company_name = data.maps.main.company_name ? coerceString(row[data.maps.main.company_name])! : '';
            curCol = 'street_address';
            newLoc.street_address = data.maps.main.street_address ? coerceString(row[data.maps.main.street_address]) : undefined;
            curCol = 'city';
            newLoc.city = data.maps.main.city ? coerceString(row[data.maps.main.city]) : undefined;
            curCol = 'state'
            newLoc.state = data.maps.main.state ? coerceString(row[data.maps.main.state]) : undefined;
            curCol = 'zip_code';
            newLoc.zip_code = data.maps.main.zip_code ? coerceNumber(row[data.maps.main.zip_code]) : undefined;
            newLoc.zip_code = newLoc.zip_code ? parseInt(`${newLoc.zip_code}`.substring(0, 5)) : undefined; //Only grab first 5 digits of 9-digit zip codes

            curCol = 'annual_average_employees';
            newLoc.annual_average_employees = coerceNumber(row[data.maps.main.annual_average_employees!])!;
            curCol = 'total_hours_worked';
            newLoc.total_hours_worked = coerceNumber(row[data.maps.main.total_hours_worked!])!;
            curCol = 'avg_work_week';
            newLoc.avg_work_week = calcAvgWorkWeek(newLoc);

            let total_incidents = 0;
            for (const m of METRIC_NAMES) {
                curCol = m;
                newLoc[m] = data.maps.main[m] && coerceNumber(row[data.maps.main[m]!]) || 0;
                if (!METRICS_EXCLUDED_INCIDENTS.includes(m)) {
                    total_incidents += newLoc[m];
                }
            }
            curCol = 'total_incidents';
            newLoc.total_incidents = total_incidents;
            curCol = 'trir';
            newLoc.trir = calcTrir(newLoc);
            curCol = 'dart';
            newLoc.dart = calcDart(newLoc);

            newLoc.archive = {};
            curCol = 'id';
            newLoc.archive.id = data.maps.archive.id ? coerceNumber(row[data.maps.archive.id])?.toString() : undefined;
            curCol = 'no_injuries_illnesses';
            newLoc.archive.no_injuries_illnesses = data.maps.archive.no_injuries_illnesses ? coerceNumber(row[data.maps.archive.no_injuries_illnesses]) : undefined;
            curCol = 'total_other_cases';
            newLoc.archive.total_other_cases = data.maps.archive.total_other_cases ? coerceNumber(row[data.maps.archive.total_other_cases]) : undefined;
            curCol = 'establishment_id';
            newLoc.archive.establishment_id = data.maps.archive.establishment_id ? coerceNumber(row[data.maps.archive.establishment_id])?.toString() : undefined; //Some OSHA files were appending .00 to the end, so first parse as an int
            curCol = 'establishment_type';
            newLoc.archive.establishment_type = data.maps.archive.establishment_type ? coerceNumber(row[data.maps.archive.establishment_type]) : undefined;
            curCol = 'size';
            newLoc.archive.size = data.maps.archive.size ? coerceNumber(row[data.maps.archive.size]) : undefined;
            curCol = 'created_timestamp';
            newLoc.archive.created_timestamp = data.maps.archive.created_timestamp ? coerceString(row[data.maps.archive.created_timestamp]) : undefined;
            curCol = 'change_reason';
            newLoc.archive.change_reason = data.maps.archive.change_reason ? coerceString(row[data.maps.archive.change_reason]) : undefined;

            //Also save all unexpected columns to location.archive
            for (const key of data.maps.unusedFields) {
                curCol = key as any;
                (newLoc.archive as any)[key] = coerceString(row[key]);
            }
    
            curCol = 'locationId';

            if (newLoc.archive.establishment_id) {
                newLoc.locationId = newLoc.archive.establishment_id;
            } else {
                data.logger.log('Querying for locationId');
                let locationIdTokens = tokenizeBiz(newLoc).slice(1); //Omit first entry since it's the full collection of words
                const locationIdQuery = new Query<ILocation>();
                locationIdQuery.select(['locationId'])
                .where(locationIdTokens.map(s => `ARRAY_CONTAINS(r.tokenized, ${locationIdQuery.addParam(s)})`))
                .orderBy('year_filing_for')
                .limit(1);
                await getLocationsContainer().items.query<Pick<ILocation, 'locationId'>>(locationIdQuery.toSql()).fetchAll().then(r => r.resources).then(matchingLocations => {
                    if (matchingLocations?.length) {
                        newLoc.locationId = matchingLocations[0].locationId;
                    } else {
                        newLoc.locationId = UUID();
                    }
                });
                data.logger.log('Done querying for locationId');
            }

            const sameLocationQuery = new Query<ILocation>();
            sameLocationQuery.select(['id', 'parent', 'place', 'past_averages'])
            .where([`r.locationId = ${sameLocationQuery.addParam(newLoc.locationId)}`])
            .orderBy('year_filing_for')
            .limit(NUM_YEARS_BACK);
            const sameLocations = await getLocationsContainer().items.query<ILocation>(sameLocationQuery.toSql()).fetchAll().then(r => r.resources);
            if (sameLocations.length) {
                const prevYear = sameLocations.find(l => l.year_filing_for == newLoc.year_filing_for - 1);
                if (prevYear) {
                    curCol = 'past_averages';
                    const pastLocations = sameLocations.filter(l => l.year_filing_for < newLoc.year_filing_for);
                    newLoc.past_averages = prevYear.past_averages || Defaults.BizMetrics();
                    for (const m of METRIC_NAMES) {
                        newLoc.past_averages![m] = (newLoc.past_averages![m] * (pastLocations.length - 1) + pastLocations[0][m]) / pastLocations.length;
                    }
                }
            }

            curCol = 'isLatest';
            if (sameLocations.length) {
                if (sameLocations.some(c => c.year_filing_for > newLoc.year_filing_for)) {
                    newLoc.isLatest = false;
                } else {
                    for (const loc of sameLocations) {
                        if (loc.isLatest != false && loc.year_filing_for < newLoc.year_filing_for) {
                            data.progress.totalTasks++;
                            data.locPatchOps.push({
                                operationType: 'Patch',
                                id: loc.id,
                                partitionKey: loc.id,
                                resourceBody: {
                                    operations: [{
                                        op: 'set',
                                        path: '/isLatest',
                                        value: false,
                                    }],
                                },
                            });
                        }
                    }
                }
            }
            if (data.ops.checkInputLocsForLatest) {
                const localSameLocs = data.locs.filter(l => l.establishment_id == newLoc.locationId);
                if (localSameLocs.some(l => coerceNumber(l.year_filing_for)! > newLoc.year_filing_for)) {
                    newLoc.isLatest = false;
                }
            }

            curCol = 'parent';
            const keyCompanyName = `${newLoc.company_name.toLocaleLowerCase()}-${newLoc.year_filing_for}`;
            const keyEIN = newLoc.ein ? `${newLoc.ein}-${newLoc.year_filing_for}` : '';
            let parent: ICompany_Embryo | undefined = data.companyMap[keyEIN] || data.companyMap[keyCompanyName];
            if (!parent) {
                let newPlaceName = '';

                if (data.ops.preservePlaceName) {
                    newPlaceName = row['place'];
                } else {
                    if (sameLocations.length) {
                        newPlaceName = sameLocations[0].place;
                    } else {
                        const pastCompanyQuery = new Query<ICompany>(['place', 'eins']);
                        const einWhere = newLoc.ein ? `r.ein = ${pastCompanyQuery.addParam(newLoc.ein)}` : '';
                        const companyNameWhere = tokenizeString(newLoc.company_name).map(t => `ARRAY_CONTAINS(r.tokens, ${pastCompanyQuery.addParam(t)})`).join(' AND ');

                        pastCompanyQuery.where(einWhere ? `(${einWhere}) OR (${companyNameWhere})` : companyNameWhere)
                        .limit(NUM_YEARS_BACK);
        
                        const pastCompanies = await getCompaniesContainer().items.query<ICompany>(pastCompanyQuery.toSql()).fetchAll().then(r => r.resources);
                        for (let i = 0; i < pastCompanies.length; i++) {
                            if (newLoc.ein && pastCompanies[i].eins.includes(newLoc.ein) || fsm(newLoc.company_name, pastCompanies[i].company_name) >= CO_NAME_SIMILARITY_THRESHOLD) {
                                newPlaceName = pastCompanies[i].place;
                                break;
                            }
                        }
                    }
                }

                //Check for a matching place again, since another location could have created one while we were awaiting
                parent = data.companyMap[keyEIN] || data.companyMap[keyCompanyName];
                if (!parent) {
                    if (!newPlaceName) {
                        let suffix = -1;
                        do {
                            suffix++;
                            let tokens = tokenizeString(newLoc.company_name);
                            newPlaceName = tokens.join('-').substring(0, 30);
                            while (newPlaceName.endsWith('-')) {
                                newPlaceName = newPlaceName.substring(0, newPlaceName.length - 1);
                            }
                            newPlaceName += (suffix ? `-${suffix}` : '');
                        } while (
                            (data.companyNameMap[newPlaceName] && data.companyNameMap[newPlaceName] != newLoc.company_name.toLocaleLowerCase())
                            || (await getCompaniesContainer().items.query<number>(`SELECT VALUE COUNT(1) FROM r WHERE r.place = '${newPlaceName}'`).fetchAll().then(r => r.resources))[0] > 0
                        );
                    }

                    //Check for a matching place AGAIN, since another location could have created one while we were awaiting
                    parent = data.companyMap[keyEIN] || data.companyMap[keyCompanyName];
                    if (!parent) {
                        data.progress.totalTasks++;
                        parent = newCompanyEmbryo(newPlaceName, newLoc.year_filing_for);
                        data.companyMap[keyCompanyName] = parent;
                        if (keyEIN) {
                            data.companyMap[keyEIN] = parent;
                        }
    
                        data.companyNameMap[newPlaceName] = newLoc.company_name.toLocaleLowerCase();
                        data.companyNames.push(keyCompanyName);
                    }
                }
            }

            newLoc.parent = parent.id;

            curCol = 'place';
            newLoc.place = parent.place;

            if (industry.naics_code) {
                let globaIndustry = data.industryMap[industry.naics_code];

                if (!globaIndustry) {
                    data.progress.totalTasks++;
                    data.industryMap[industry.naics_code] = {
                        id: '',
                        naics_code: industry.naics_code,
                        captions: [],
                        year_filing_for: newLoc.year_filing_for,
                        num_locations: 0,
                        averages: Defaults.BizMetrics(),
                        version: 1,
                    };
                    globaIndustry = data.industryMap[industry.naics_code];
                }

                globaIndustry.num_locations++;
                if (industry.caption && !globaIndustry.captions.includes(industry.caption)) {
                    globaIndustry.captions.push(industry.caption);
                }
                for (const m of METRIC_NAMES) {
                    globaIndustry.averages[m] = (globaIndustry.averages[m] || 0) + newLoc[m];
                }
            }

            newLoc.id = getId(newLoc);
            curCol = 'tokenized';
            newLoc.tokenized = tokenizeBiz(newLoc);
            curCol = 'tokenizedCompanyName';
            newLoc.tokenizedCompanyName = tokenizeString(newLoc.company_name);
            curCol = 'charCount';
            newLoc.charCount = generateCharCount([newLoc.company_name, newLoc.establishment_name].map(s => s).join(' '));
    
            data.locsToUpload.push(newLoc);

            if (data.ops.skipLocations) {
                data.progress.completedTasks++;
            }
        } catch (ex) {
            data.numLocErrors++;
            data.progress.completedTasks++;
            data.progress.totalTasks++;
            data.errors.push({
                task: 'parseLocation',
                col: curCol,
                msg: ex as string,
                data: data.locs[idx],
            });
        } finally {
            resolve();
        }
    });
}

async function beginLocationUploads(data: IProcessingData): Promise<void> {
    return new Promise(async (resolve) => {
        data.logger.log(`Uploading ${data.locs.length} locations`);

        while (data.numLocsUploaded + data.numLocErrors + data.locPatchOps.length < data.locs.length) {
            if (data.locsToUpload.length == 0 && data.locPatchOps.length == 0) {
                await new Promise<void>((res) => {
                    setTimeout(() => {
                        res();
                    }, 1100);
                });
            }

            if (data.locsToUpload.length > 0) {
                const uploadBatch = data.locsToUpload.splice(0, Math.min(data.locsToUpload.length, NUM_BATCH_SAVE));
    
                const upsertOps: OperationInput[] = [];
                for (let i = 0; i < uploadBatch.length; i++) {
                    upsertOps.push({
                        operationType: 'Upsert', //Will overwrite existing records for that same locationId + year, which is what we want
                        resourceBody: uploadBatch[i] as {},
                    });
                }
    
                const results = await getLocationsContainer().items.bulk(upsertOps, { continueOnError: true, });
    
                let numToRetry = 0;
                for (let i = 0; i < results.length; i++) {
                    if (results[i].statusCode == 429) {
                        numToRetry++;
                        data.locsToUpload.push(uploadBatch[i]);
                    } else if (!dbSuccess(results[i])) { //Unknown error code
                        data.progress.completedTasks++;
                        data.progress.totalTasks++;
                        data.errors.push({
                            task: 'uploadLocation',
                            msg: `${results[i].statusCode}\t` + JSON.stringify(uploadBatch[i]),
                        });
                    } else {
                        data.progress.completedTasks++;
                    }
                }

                if (numToRetry > 0) {
                    NUM_BATCH_SAVE--;
                } else {
                    NUM_BATCH_SAVE++;
                }
                NUM_BATCH_SAVE = Math.max(40, Math.min(100, NUM_BATCH_SAVE));
    
                data.numLocsUploaded += uploadBatch.length - numToRetry;
                data.logger.log(`Uploaded ${data.numLocsUploaded} locations (${Math.floor(data.numLocsUploaded / (data.locs.length - data.numLocErrors) * 100)}%)`);
            }

            if (data.locPatchOps.length > 0) {
                const uploadBatch = data.locPatchOps.splice(0, Math.min(data.locPatchOps.length, NUM_BATCH_SAVE));
                const results = await getLocationsContainer().items.bulk(uploadBatch, { continueOnError: true, });

                let numToRetry = 0;
                for (let i = 0; i < results.length; i++) {
                    if (results[i].statusCode == 429) {
                        numToRetry++;
                        data.locPatchOps.push(uploadBatch[i]);
                    } else if (!dbSuccess(results[i])) { //Unknown error code
                        data.progress.completedTasks++;
                        data.progress.totalTasks++;
                        data.errors.push({
                            task: 'patchLocation',
                            msg: `${results[i].statusCode}\t` + JSON.stringify(uploadBatch[i]),
                        });
                    } else {
                        data.progress.completedTasks++;
                    }
                }

                if (numToRetry > 0) {
                    NUM_BATCH_SAVE--;
                } else {
                    NUM_BATCH_SAVE++;
                }
                NUM_BATCH_SAVE = Math.max(40, Math.min(100, NUM_BATCH_SAVE));
            }
        }

        resolve();
    });
}

async function beginCompanyChain(data: IProcessingData) {
    while (data.numCompaniesParsed < data.companyNames.length) {
        await processCompany(data, data.numCompaniesParsed++);
    }
}

async function processCompany(data: IProcessingData, idx: number) {
    try {
        const newCompany = data.companyMap[data.companyNames[idx]];

        const locQuery = new Query<ILocation>();
        locQuery.where([`r.parent = ${locQuery.addParam(newCompany.id)}`]);
        let hasMore = true;
        let continuationToken: string | undefined = undefined;
        while (hasMore) {
            await getLocationsContainer().items.query<ILocation>(locQuery.toSql(), { maxItemCount: 50, continuationToken }).fetchNext().then(r => {
                for (const loc of r.resources) {
                    addLocToCompany(newCompany, loc);
                }
                hasMore = r.hasMoreResults;
                continuationToken = r.continuationToken;
            });
        }
        
        if (newCompany.locationSums && Object.keys(newCompany.locationSums).length > 0) {
            const sumsSorted = Object.values(newCompany.locationSums).sort((a, b) => {
                if (a.annual_average_employees! > b.annual_average_employees!) {
                    return -1;
                } else if (b.annual_average_employees! > a.annual_average_employees!) {
                    return 1;
                } else {
                    return 0;
                }
            });

            newCompany.industry = sumsSorted[0].industry;
            newCompany.industries = sumsSorted.map(s => {
                return {
                    annual_average_employees: s.annual_average_employees,
                    ...s.industry
                };
            });

            newCompany.ein = sumsSorted[0].ein
            newCompany.company_name = sumsSorted[0].company_name;
            
            newCompany.street_address = sumsSorted[0].company_name
            newCompany.city = sumsSorted[0].city;
            newCompany.state = sumsSorted[0].state;
            newCompany.zip_code = sumsSorted[0].zip_code;
    
            newCompany.archive = newCompany.archive || {};
            newCompany.archive.establishment_id = sumsSorted[0].establishment_id;
            newCompany.archive.establishment_type = sumsSorted[0].establishment_type;
            newCompany.archive.size = sumsSorted[0].size;
            newCompany.archive.created_timestamp = sumsSorted[0].created_timestamp;
    
            if (Object.keys(newCompany.archive).length == 0) {
                delete newCompany.archive;
            }

            //Finally, delete this data structure since we don't want it in the DB
            delete (newCompany as Partial<ICompany_Embryo>).locationSums;
        }

        newCompany.tokenized = tokenizeBiz(newCompany);
        newCompany.tokenizedCompanyName = tokenizeString(newCompany.company_name);
        newCompany.charCount = generateCharCount(newCompany.company_name);
        
        //location_averages
        for (const m of METRIC_NAMES) {
            newCompany.averages_per_loc[m] = newCompany[m] / newCompany.num_locations;
        }
        newCompany.trir = calcTrir(newCompany);
        newCompany.dart = calcDart(newCompany);
        newCompany.avg_work_week = calcAvgWorkWeek(newCompany);

        const pastCompanyQuery = new Query<ICompany>();
        pastCompanyQuery.where([`r.place = ${pastCompanyQuery.addParam(newCompany.place)}`])
        .orderBy('year_filing_for')
        .order('DESC')
        .limit(NUM_YEARS_BACK);
        let sameCompanies = await getCompaniesContainer().items.query<ICompany>(pastCompanyQuery.toSql()).fetchAll().then(r => r.resources);

        if (data.yearsRepresented.length > 1) {
            for (let i = 0; i < data.companyNames.length; i++) {
                const curCompany = data.companyMap[data.companyNames[i]];
                if (curCompany.place == newCompany.place && curCompany.year_filing_for < newCompany.year_filing_for) {
                    const existingIdx = sameCompanies.findIndex(p => p.year_filing_for == curCompany.year_filing_for);
                    if (existingIdx > -1) {
                        sameCompanies.splice(existingIdx, 1, curCompany);
                    } else {
                        sameCompanies.push(curCompany);
                    }
                }
            }
            
            sameCompanies.sort((a, b) => {
                if (a.year_filing_for > b.year_filing_for) {
                    return -1;
                } else if (a.year_filing_for < b.year_filing_for) {
                    return 1;
                } else {
                    return 0;
                }
            });
        }

        if (sameCompanies.length) {
            const prevComp = sameCompanies.find(c => c.year_filing_for < newCompany.year_filing_for); //First match will be the most recent year before this one

            if (prevComp) {
                newCompany.website = prevComp.website;
                newCompany.logo = prevComp.logo;
                newCompany.headerImg = prevComp.headerImg;
                newCompany.num_reviews = prevComp.num_reviews;
                newCompany.average_review = prevComp.average_review;
                newCompany.popularity = prevComp.popularity;
                
                newCompany.past_averages = prevComp.past_averages || Defaults.BizMetrics();
                const numOlder = sameCompanies.filter(c => c.year_filing_for < newCompany.year_filing_for).length;
                for (const m of METRIC_NAMES) {
                    newCompany.past_averages![m] = (newCompany.past_averages![m] * (numOlder - 1) + prevComp[m]) / numOlder;
                }
            }

            if (sameCompanies.some(c => c.year_filing_for > newCompany.year_filing_for)) {
                newCompany.isLatest = false;
            } else {
                for (const comp of sameCompanies) {
                    if (comp.isLatest != false && comp.year_filing_for < newCompany.year_filing_for) {
                        data.progress.totalTasks++;
                        data.companyPatchOps.push({
                            operationType: 'Patch',
                            id: comp.id,
                            partitionKey: comp.id,
                            resourceBody: {
                                operations: [{
                                    op: 'set',
                                    path: '/isLatest',
                                    value: false,
                                }]
                            }
                        });
                    }
                }
            }
        }

        newCompany.popularity = Math.max(newCompany.popularity || Math.log10(newCompany.annual_average_employees || 1) * 10);

        newCompany.wsi_score = await calcWsiScore(newCompany);
        if (newCompany.industry?.naics_code && data.industryMap[newCompany.industry.naics_code]) {
            data.industryMap[newCompany.industry.naics_code].averages.wsi_score = (data.industryMap[newCompany.industry.naics_code].averages.wsi_score || 0) + newCompany.wsi_score!.score;
        }

        data.companiesToUpload.push(newCompany);
    } catch (ex) {
        data.numCompaniesErrors++;
        data.progress.completedTasks++;
        data.progress.totalTasks++;
        data.errors.push({
            task: 'parseCompany',
            msg: `${ex}`,
        });
    }
}

function addLocToCompany(company: ICompany_Embryo, loc: ILocation) {
    company.num_locations++;
    
    if (loc.ein && !company.eins.includes(loc.ein)) {
        company.eins.push(loc.ein);
    }
    
    company.year_filing_for = company.year_filing_for || loc.year_filing_for;

    if (loc.industry?.naics_code) {
        let sums = company.locationSums[loc.industry.naics_code] || {
            annual_average_employees: 0,
        };
        company.locationSums[loc.industry.naics_code] = sums;
        
        sums.annual_average_employees! += (loc.annual_average_employees || 0);

        sums.industry = sums.industry || loc.industry;
        sums.ein = sums.ein || loc.ein;
        sums.company_name = sums.company_name || loc.company_name;
        sums.city = sums.city || loc.city;
        sums.state = sums.state || loc.state;
        sums.zip_code = sums.zip_code || loc.zip_code;

        sums.establishment_id = sums.establishment_id || loc.archive?.establishment_id;
        sums.establishment_type = sums.establishment_type || loc.archive?.establishment_type;
        sums.size = sums.size || loc.archive?.size;
        sums.created_timestamp = sums.created_timestamp || loc.archive?.created_timestamp;
    }

    company.archive = company.archive || {};
    if (loc.archive?.no_injuries_illnesses != null) {
        company.archive.no_injuries_illnesses = (company.archive.no_injuries_illnesses || 0) + loc.archive.no_injuries_illnesses;
    }
    if (loc.archive?.total_other_cases != null) {
        company.archive.total_other_cases = (company.archive.total_other_cases || 0) + loc.archive.total_other_cases;
    }

    if (loc.annual_average_employees) {
        company.annual_average_employees = (company.annual_average_employees || 0) + loc.annual_average_employees;
    }
    if (loc.total_hours_worked) {
        company.total_hours_worked = (company.total_hours_worked || 0) + loc.total_hours_worked;
    }

    for (const m of METRIC_NAMES) {
        company[m] += loc[m];
    }
}

async function beginCompanyUploads(data: IProcessingData): Promise<void> {
    return new Promise(async (resolve) => {
        data.logger.log(`Uploading ${data.companyNames.length} companies`);

        while (data.numCompaniesUploaded + data.numCompaniesErrors + data.companyPatchOps.length < data.companyNames.length) {
            if (data.companiesToUpload.length == 0 && data.companyPatchOps.length == 0) {
                await new Promise<void>((res) => {
                    setTimeout(() => {
                        res();
                    }, 1000);
                });
            }

            if (data.companiesToUpload.length > 0) {
                const uploadBatch = data.companiesToUpload.splice(0, Math.min(data.companiesToUpload.length, NUM_BATCH_SAVE));
    
                const upsertOps: OperationInput[] = [];
                for (let i = 0; i < uploadBatch.length; i++) {
                    upsertOps.push({
                        operationType: 'Upsert', //Will overwrite existing records for that same company + year, which is what we want
                        resourceBody: uploadBatch[i] as {},
                    });
                }
    
                const results = await getCompaniesContainer().items.bulk(upsertOps, { continueOnError: true, });
    
                let numToRetry = 0;
                for (let i = 0; i < results.length; i++) {
                    if (results[i].statusCode == 429) {
                        numToRetry++;
                        data.companiesToUpload.push(uploadBatch[i]);
                    } else if (!dbSuccess(results[i])) { //Unknown error code
                        data.progress.completedTasks++;
                        data.progress.totalTasks++;
                        data.errors.push({
                            task: 'uploadCompany',
                            msg: `${results[i].statusCode}\t` + JSON.stringify(uploadBatch[i]),
                        });
                    } else {
                        data.progress.completedTasks++;
                    }
                }

                if (numToRetry > 0) {
                    NUM_BATCH_SAVE--;
                } else {
                    NUM_BATCH_SAVE++;
                }
                NUM_BATCH_SAVE = Math.max(40, Math.min(100, NUM_BATCH_SAVE));
    
                data.numCompaniesUploaded += uploadBatch.length - numToRetry;
                data.logger.log(`Uploaded ${data.numCompaniesUploaded} companies (${Math.floor(data.numCompaniesUploaded / (data.companyNames.length - data.numCompaniesErrors) * 100)}%)`);
            }

            if (data.companyPatchOps.length > 0) {
                const uploadBatch = data.companyPatchOps.splice(0, Math.min(data.companyPatchOps.length, NUM_BATCH_SAVE));
                const results = await getCompaniesContainer().items.bulk(uploadBatch, { continueOnError: true, });
    
                let numToRetry = 0;
                for (let i = 0; i < results.length; i++) {
                    if (results[i].statusCode == 429) {
                        numToRetry++;
                        data.companyPatchOps.push(uploadBatch[i]);
                    } else if (!dbSuccess(results[i])) { //Unknown error code
                        data.progress.completedTasks++;
                        data.progress.totalTasks++;
                        data.errors.push({
                            task: 'patchCompany',
                            msg: `${results[i].statusCode}\t` + JSON.stringify(uploadBatch[i]),
                        });
                    } else {
                        data.progress.completedTasks++;
                    }
                }

                if (numToRetry > 0) {
                    NUM_BATCH_SAVE--;
                } else {
                    NUM_BATCH_SAVE++;
                }
                NUM_BATCH_SAVE = Math.max(40, Math.min(100, NUM_BATCH_SAVE));
            }
        }

        resolve();
    });
}

function newCompanyEmbryo(placeName: string, year_filing_for: number): ICompany_Embryo {
    const p = {
        ...Defaults.ICompany(),
        locationSums: {},
        place: placeName,
        year_filing_for: year_filing_for,
    };
    p.id = getId(p);
    return p;
}

async function beginIndustryUploads(data: IProcessingData): Promise<void> {
    data.progress.task = 'Calculating industry averages';

    const naicsCodes = Object.keys(data.industryMap);

    return new Promise(async (resolve) => {
        data.logger.log(`Uploading ${naicsCodes.length} industries`);

        while (naicsCodes.length) {
            const uploadBatch = naicsCodes.splice(0, Math.min(naicsCodes.length, NUM_BATCH_SAVE));

            const upsertOps: OperationInput[] = [];
            for (let i = 0; i < uploadBatch.length; i++) {
                const curIndustry = data.industryMap[uploadBatch[i] as any];
                curIndustry.id = `ind-${curIndustry.naics_code}-${curIndustry.year_filing_for}`;
                for (const m of METRIC_NAMES) {
                    curIndustry.averages[m]  = curIndustry.averages[m] / curIndustry.num_locations;
                }
                if (curIndustry.averages.wsi_score != null) {
                    curIndustry.averages.wsi_score /= curIndustry.num_locations;
                }

                upsertOps.push({
                    operationType: 'Upsert',
                    resourceBody: curIndustry as {},
                });
            }

            const results = await getIndustryInfoContainer().items.bulk(upsertOps, { continueOnError: true, });

            let numToRetry = 0;
            for (let i = 0; i < results.length; i++) {
                if (results[i].statusCode == 429) {
                    numToRetry++;
                    naicsCodes.push(uploadBatch[i]);
                } else if (!dbSuccess(results[i])) { //Unknown error code
                    data.progress.totalTasks++;
                    data.errors.push({
                        task: 'uploadIndustry',
                        msg: `${results[i].statusCode}\t` + JSON.stringify(data.industryMap[uploadBatch[i] as any]),
                    });
                }
            }

            if (numToRetry > 0) {
                NUM_BATCH_SAVE--;
            } else {
                NUM_BATCH_SAVE++;
            }
            NUM_BATCH_SAVE = Math.max(40, Math.min(100, NUM_BATCH_SAVE));

            data.progress.completedTasks += uploadBatch.length - numToRetry;
            data.logger.log(`${naicsCodes.length} industries remaining to upload`);
        }

        resolve();
    });
}

async function beginErrorUploads(data: IProcessingData): Promise<void> {
    data.progress.task = 'Logging errors';
    const date = new Date();

    return new Promise(async (resolve) => {
        data.logger.log(`Uploading ${data.errors.length} errors`);
        let numErrorsUploaded = 0;
        let numErrorUploadsFailed = 0;

        while (data.errors.length > 0) {
            const uploadBatch = data.errors.splice(0, Math.min(data.errors.length, NUM_BATCH_SAVE));

            const upsertOps: OperationInput[] = [];
            for (let i = 0; i < uploadBatch.length; i++) {
                upsertOps.push({
                    operationType: 'Upsert',
                    resourceBody: {
                        filename: data.progress.filename,
                        nonce: data.progress.nonce,
                        created: date.toISOString(),
                        ...uploadBatch[i],
                    },
                });
            }

            const results = await getErrorsContainer().items.bulk(upsertOps, { continueOnError: true, });

            for (let i = 0; i < results.length; i++) {
                if (results[i].statusCode == 429) {
                    data.errors.push(uploadBatch[i]);
                } else {
                    if (dbSuccess(results[i])) {
                        numErrorsUploaded++;
                    } else {
                        console.log('Error failed to upload:', uploadBatch[i]);
                        numErrorUploadsFailed++;
                    }
                    data.progress.completedTasks++;
                }
            }

            data.logger.log(`Uploaded ${numErrorsUploaded} errors`);
        }
        
        data.logger.log(`Uploaded ${numErrorsUploaded} errors total. Unable to upload ${numErrorUploadsFailed}.`);
        resolve();
    });
}

function dbSuccess(res: OperationResponse): boolean {
    return res.statusCode >= 200 && res.statusCode < 300;
}

//Holds data grabbed straight from the file, without any type checking, coercion, or other processing
export type ILocation_Raw = Partial<Record<keyof Omit<ILocation, 'industry' | 'archive'>, string>>
    & { archive: Partial<Record<keyof NonNullable<ILocation['archive']>, string>> }
    & { industry: Partial<Record<keyof IIndustry, string>> }
    & { unusedFields?: { [key: string]: string } };

//Proto-company that will become a full company someday
interface ICompany_Embryo extends ICompany {
    //Tally all industries and use the one with the highest sum of employees as this company's main industry
    locationSums: {
        [code: NonNullable<IIndustry['naics_code']>]:
        Pick<ILocation, 'industry' | 'ein' | 'company_name' | 'annual_average_employees' | 'city' | 'street_address' | 'state' | 'zip_code'>
        & Pick<NonNullable<ILocation['archive']>, 'establishment_id' | 'establishment_type' | 'size' | 'created_timestamp'>
    };

    //If you add any more field, make sure to delete them in processCompanies()!
}

interface IError {
    task: 'parseLocation' | 'parseCompany' | 'uploadLocation' | 'uploadCompany' | 'patchLocation' | 'patchCompany' | 'uploadIndustry';
    col?: string | null;
    msg?: string;
    data?: any;
}

interface IProcessingData {
    ops: {
        filename?: string;
        preservePlaceName?: boolean;
        skipLocations?: Payloads.IFinishImport['skipLocations'];
        checkInputLocsForLatest?: boolean; //Will check all locations passed in to see if the current loc is the latest or not. This will dramatically hinder performance for large datasets, so should be off by default.
    };
    maps: Awaited<ReturnType<typeof generateOshaFieldMaps>>;
    yearsRepresented: number[]; 

    locs: IBiz_Flat[];
    locsToUpload: ILocation[];
    numLocsParsed: number;
    numLocsUploaded: number;
    numLocErrors: number;
    locPatchOps: OperationInput[]; //For removing the 'isLatest' flag from locations that now have a newer record

    companyMap: { [key: (IBiz['company_name'] | NonNullable<IBiz['ein']>)]: ICompany_Embryo }; //This map will contain duplicates (the same company listed by company_name and ein), so don't use Object.keys() or similar
    companyNameMap: { [key: IBiz['place']]: IBiz['company_name'] };
    companyNames: string[];
    companiesToUpload: ICompany[];
    numCompaniesParsed: number;
    numCompaniesUploaded: number;
    numCompaniesErrors: number;
    companyPatchOps: OperationInput[]; //For removing the 'isLatest' flag from companies that now have a newer record

    industryMap: { [key: IIndustryInfo['naics_code']]: IIndustryInfo };
    errors: IError[];

    progress: Required<Payloads.IFinishImport>;
    logger: Logger;
}

interface IProgress extends Required<Payloads.IFinishImport> {
    revalidateUrls: string[];
}