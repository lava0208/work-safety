/*
NEVER import this file on a client-side page.
For one thing, it won't work. (Environment variables are only populated on the server, so connections to the DB will fail.)
For the other, it includes security-sensative material.

Instead, create a pass-through via db-client.ts and a new API endpoint.
See wsi.ts > DBTypes.GetCompanies() as an example.
*/

import { CosmosClient, Container } from "@azure/cosmos";
import { StorageSharedKeyCredential, BlobServiceClient, ContainerClient } from "@azure/storage-blob";
import { IIndustryInfo, IIndustry, ILocation, tokenizeString, DBTypes, UUID, ISearchRecord, Query, IBiz, ICompany, POP_INCREMENT } from "./wsi";
import fsm from 'fuzzy-string-matching';

const RELATED_SIZE = 2; //Related companies have to be within this multiple of # employees. I.e., Not more than 2x the size of the anchor company.

export const getCompaniesContainer = (() => {
    let container: Container | null = null;
    return () => {
        if (!container) {
            container = new CosmosClient({
                endpoint: process.env.DB_ENDPOINT as string,
                key: process.env.DB_ACCOUNT_KEY,
            })
                .database('wsi')
                .container('companies');
        }

        return container;
    };
})();

export const getLocationsContainer = (() => {
    let container: Container | null = null;
    return () => {
        if (!container) {
            container = new CosmosClient({
                endpoint: process.env.DB_ENDPOINT as string,
                key: process.env.DB_ACCOUNT_KEY,
            })
                .database('wsi')
                .container('locations');
        }

        return container;
    };
})();

export const getIndustryInfoContainer = (() => {
    let container: Container | null = null;
    return () => {
        if (!container) {
            container = new CosmosClient({
                endpoint: process.env.DB_ENDPOINT as string,
                key: process.env.DB_ACCOUNT_KEY,
            })
                .database('wsi')
                .container('industry_info');
        }

        return container;
    };
})();

const getSearchesContainer = (() => {
    let container: Container | null = null;
    return () => {
        if (!container) {
            container = new CosmosClient({
                endpoint: process.env.DB_ENDPOINT as string,
                key: process.env.DB_ACCOUNT_KEY,
            })
                .database('wsi')
                .container('searches');
        }

        return container;
    };
})();

export const getErrorsContainer = (() => {
    let container: Container | null = null;
    return () => {
        if (!container) {
            container = new CosmosClient({
                endpoint: process.env.DB_ENDPOINT as string,
                key: process.env.DB_ACCOUNT_KEY,
            })
                .database('wsi')
                .container('errors');
        }

        return container;
    };
})();

const getStaticContainer = (() => {
    let container: Container | null = null;
    return () => {
        if (!container) {
            container = new CosmosClient({
                endpoint: process.env.DB_ENDPOINT as string,
                key: process.env.DB_ACCOUNT_KEY,
            })
                .database('wsi')
                .container('static');
        }

        return container;
    };
})();

export const getUploadsBlobContainer = (() => {
    let client: ContainerClient | null = null;
    return () => {
        if (!client) {
            const sharedKeyCred = new StorageSharedKeyCredential(process.env.BLOB_ACCOUNT_NAME!, process.env.BLOB_ACCOUNT_KEY!);
            client = new BlobServiceClient(`https://${process.env.BLOB_ACCOUNT_NAME}.blob.core.windows.net/`, sharedKeyCred).getContainerClient('uploads');
        }
        return client;
    };
})();

export const getDownloadsBlobContainer = (() => {
    let client: ContainerClient | null = null;
    return () => {
        if (!client) {
            const sharedKeyCred = new StorageSharedKeyCredential(process.env.BLOB_ACCOUNT_NAME!, process.env.BLOB_ACCOUNT_KEY!);
            client = new BlobServiceClient(`https://${process.env.BLOB_ACCOUNT_NAME}.blob.core.windows.net/`, sharedKeyCred).getContainerClient('downloads');
        }
        return client;
    };
})();

export async function getIndustryInfos(ops: { naicsCode?: IIndustry['naics_code'], limit?: number, project?: (keyof IIndustryInfo)[] }): Promise<Partial<IIndustryInfo>[]> {
    const query = new Query(ops.project);

    if (ops.naicsCode) {
        query
            .where(`r.naics_code = ${query.addParam(ops.naicsCode)}`)
            .orderBy('year_filing_for');
    } else {
        return [];
    }

    query.offset(0).limit(ops.limit || 20);

    return getIndustryInfoContainer().items.query<IIndustryInfo>(query.toSql()).fetchAll().then(r => r.resources);
}

export const search: DBTypes.Search = async (ops) => {
    const id = UUID();
    const blank: DBTypes.ISearchResult = {
        searchId: id,
        results: [],
        totalCount: 0,
        hasMore: false,
    };

    const query = new Query<ICompany>();
    query.where('r.isLatest = true');
    query.offset(ops.offset || 0).limit(ops.limit || (ops.mode == 'search' ? 20 : 5));
    let searchTokens: string[] = [];

    if (ops.mode == 'search') {
        if (ops.search != '') {
            searchTokens = tokenizeString(ops.search);
            query.addWhere(generateSearchWhere(searchTokens, query));
        }

        if (ops.omit?.length) {
            query.addWhere(ops.omit.map(o => `r.place != ${query.addParam(o)}`));
        }

        if (ops.sort == 'safety') {
            query.orderBy('wsi_score.score' as any);
        } else {
            query.orderBy('popularity');
        }
    } else if (ops.mode == 'paginate') {
        const prevSearch = await getSearchesContainer().item(ops.search, ops.search).read<ISearchRecord>().then(r => r.resource);
        if (!prevSearch) {
            return blank;
        }

        query.fromJson(prevSearch!.query);
        query.addWhere(`r.place NOT IN (${prevSearch.results.map(r => `${query.addParam(r.place)}`).join(', ')})`);
    } else if (ops.mode == 'related') {
        const prevSearch = await getSearchesContainer().item(ops.search, ops.search).read<ISearchRecord>().then(r => r.resource);
        let naicsCode: IIndustry['naics_code'] | undefined;
        if (!prevSearch || prevSearch.results.length == 0) {
            return blank;
        }
        
        naicsCode = await getCompaniesContainer().item(prevSearch.results[0].id, prevSearch.results[0].id).read<ICompany>().then(r => r.resource?.industry?.naics_code);
        query
            .addWhere([
                `r.isLatest = true`,
                `r.industry.naics_code = ${naicsCode}`,
                `r.annual_average_employees < ${prevSearch.results[0].annual_average_employees * RELATED_SIZE}`,
                prevSearch?.results && prevSearch.results.length > 0 ? `r.place NOT IN (${prevSearch.results.map(r => `${query.addParam(r.place)}`).join(', ')})` : '',
            ])
            .orderBy('popularity');
    }

    return await Promise.all([
        getCompaniesContainer().items.query<ICompany>(query.toSql()).fetchAll().then(r => r.resources),
        getCompanyCount(query),
    ]).then(async (vals) => {
        let results: ICompany[] = vals[0];
        results = calcRelevance<ISearch_Sortable<ICompany>>(searchTokens, results);
        if (ops.sort != 'safety') {
            results.sort(sortByRelevance);
        }
        
        const totalCount = vals[1];
    
        getSearchesContainer().items.create<ISearchRecord>({ //No need to await this
            ...ops,
            id: id,
            query: query.toJson(),
            results: results.map(r => {
                return {
                    id: r.id,
                    place: r.place,
                    annual_average_employees: r.annual_average_employees,
                };
            }),
            date: new Date().toISOString(),
        });
    
        return {
            results,
            totalCount,
            searchId: id,
            hasMore: results.length == query._limit,
        };
    });
};

export const getLocations: DBTypes.GetLocations = async (ops) => {
    const query = new Query<ILocation>(ops.project);

    if (ops.ids?.length) {
        const whereClauses: string[] = [];
        for (const id of ops.ids) {
            whereClauses.push(`r.id = ${query.addParam(id)}`);
        }
        query.addWhere(`(${whereClauses.join(' OR ')})`);
        query.orderBy('year_filing_for');
    } else if (ops.locationId) {
        query.where(`r.locationId = ${query.addParam(ops.locationId)}`);
    } else if (ops.relatedTo) {
        if ((ops.relatedTo as ILocation).parent == null) { //'loc' is a company
            query.where([
                `r.place = ${query.addParam((ops.relatedTo as ICompany).place)}`,
                `r.isLatest = true`,
            ]);
        } else { //'loc' is a location
            query.where([
                `r.place = ${query.addParam((ops.relatedTo as ILocation).place)}`,
                `r.locationId != ${query.addParam((ops.relatedTo as ILocation).locationId)}`,
                `r.year_filing_for = ${query.addParam((ops.relatedTo as ILocation).year_filing_for)}`,
            ]);
        }
    } else {
        return [];
    }

    let searchTokens: string[] = [];
    if (ops.search) {
        if (query._select.length) {
            query.addSelect('tokenized');
        }
        searchTokens = tokenizeString(ops.search);
        query.addWhere(generateSearchWhere(searchTokens, query)).orderBy('annual_average_employees');
    }
    
    if (ops.orderBy) {
        query.orderBy(ops.orderBy);
    }
    if (ops.order) {
        query.order(ops.order);
    }

    if (!query._orderBy) {
        query.orderBy('establishment_name').order('ASC');
    }

    query.offset(ops.offset || 0);
    query.limit(ops.limit || 5);

    let results = await getLocationsContainer().items.query<ILocation>(query.toSql()).fetchAll().then(r => r.resources);

    if (ops.search) {
        results = calcRelevance(searchTokens, results);
        (results as ISearch_Sortable<ILocation>[]).sort(sortByRelevance);
    }

    return results;
};

export const getCompanies: DBTypes.GetCompanies = async (ops) => {
    let query = new Query<ICompany>()
    .offset(0).limit(ops.limit || 5);

    if (ops.id) {
        query.where(`r.id = ${query.addParam(ops.id)}`);
    } else if (ops.place) {
        query
            .where([
                `r.place = ${query.addParam(ops.place)}`,
            ])
            .orderBy('year_filing_for');
    } else if (ops.relatedTo) {
        query.where([
            'r.isLatest = true',
            `r.industry.naics_code = ${query.addParam(ops.relatedTo.industry!.naics_code!)}`,
            `r.annual_average_employees < ${query.addParam(ops.relatedTo.annual_average_employees * RELATED_SIZE)}`,
            `r.place != ${query.addParam(ops.relatedTo.place)}`,
        ])
        .orderBy('popularity');
    } else if (ops.preset) {
        switch (ops.preset) {
            case 'mostPopular':
                query
                    .where([
                        'r.isLatest = true',
                        `r.popularity > 50`,
                    ]);
                break;
            case 'safest':
                query
                    .where([
                        'r.isLatest = true',
                        `r.wsi_score.score > 90`,
                    ])
                    .orderBy([
                        'wsi_score.score' as any,
                        'annual_average_employees',
                    ]);
                break;
        }
    } else {
        return [];
    }

    if (ops.naics_code) {
        query.addWhere(`r.industry.naics_code = ${query.addParam(ops.naics_code)}`);
    }

    let results: ICompany[] = [];
    if (ops.relatedTo || ops.preset) {
        results = await getCompaniesContainer().items.query(query.toSql()).fetchAll().then(r => r.resources);
    } else {
        query.offset(0).limit(ops.limit || 20);
        results = await getCompaniesContainer().items.query<ICompany>(query.toSql()).fetchAll().then(r => r.resources);
    }
    return results;
};

export function incrementPopularity(c: ICompany) {
    getCompaniesContainer().item(c.id, c.id).patch({
        operations: [{
            op: 'incr',
            path: '/popularity',
            value: POP_INCREMENT,
        }],
    });
}

export async function getStaticRecord<T>(id?: string, query?: Query<T>): Promise<T | undefined> {
    if (id) {
        return getStaticContainer().item(id, id).read().then(r => r.resource);
    } else if (query) {
        return getStaticContainer().items.query(query.toSql()).fetchAll().then(r => r.resources) as T;
    } else {
        return;
    }
}

export async function setStaticRecord<T>(id: string, record: any): Promise<any> {
    return getStaticContainer().item(id, id).replace(record);
}

export const getFileBlobNames: DBTypes.GetFileNames = async (ops) => {
    const names: string[] = [];
    for await (const response of getUploadsBlobContainer().listBlobsFlat({ prefix: ops.prefix }).byPage({ maxPageSize: 20 })) {
        for (const blob of response.segment.blobItems) {
            names.push(blob.name);
        }
    }
    return names;
};

function getCompanyCount(query: Query<any>): Promise<number> {
    const queryStr = `SELECT VALUE COUNT(companies) FROM (SELECT DISTINCT r.place FROM r WHERE ${query._where.join(' AND ')}) as companies`;
    return getCompaniesContainer().items.query<number>({
        query: queryStr,
        parameters: query.listParams(),
    }).fetchAll().then(r => r.resources[0]);
}

function calcRelevance<T extends Partial<IBiz>>(searchTokens: string[], bizs: T[]): T[] {
    for (let i = 0; i < bizs.length; i++) {
        const cur = bizs[i] as ISearch_Sortable<IBiz>;
        cur.relevance = (cur as ICompany).popularity || 0;

        const companyNameTokens = cur.company_name ? tokenizeString(cur.company_name) : [];

        for (let searchToken of searchTokens) {
            for (let compNameToken of companyNameTokens) {
                if (compNameToken.includes(searchToken)) {
                    cur.relevance! += 10; //Boost results when it exactly matches words in the company's name
                }
            }

            for (let token of cur.tokenized.slice(1)) {
                //Fuzzy string match, times a constant to put it in the ballpark of 'popularity'
                cur.relevance! += Math.pow(fsm(searchToken, token), 2) * 5;
            }
        }
    }

    return bizs;
}

function sortByRelevance(a: ISearch_Sortable<any>, b: ISearch_Sortable<any>): number {
    if (a.relevance! > b.relevance!) {
        return -1;
    } else if (a.relevance! < b.relevance!) {
        return 1;
    } else {
        return 0;
    }
}

function generateSearchWhere(searchTokens: string[], query: Query<any>): string[] {
    const whereClauses = searchTokens.slice(0, searchTokens.length - 1).map(s => `ARRAY_CONTAINS(r.tokenized, ${query.addParam(s)})`);

    /*
    Turns out a bunch of STARTSWITH() clauses are still 1/20th the cost of a single CONTAINS().
    So assume the first 16 tokens should be enough to contain the biz's name,
    and search all of those using a STARTSWITH().
    */
    const orClauses = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16].map(n => `STARTSWITH(r.tokenized[${n}], ${query.addParam(searchTokens[searchTokens.length - 1])})`);
    whereClauses.push(`(${orClauses.join(' OR ')})`);

    return whereClauses;
}

type ISearch_Sortable<T> = T & {
    relevance?: number;
};