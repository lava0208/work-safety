import { v4 } from "uuid";
import neatCsv, { Row as CSVRow } from "neat-csv";
import { getUploadsBlobContainer, getStaticRecord } from "./db-server";
import fsm from 'fuzzy-string-matching';
import { PassThrough } from "stream";
import { SqlQuerySpec } from "@azure/cosmos";

export const START_YEAR = 2016;
export const TOTAL_YEARS = new Date().getFullYear() - START_YEAR;
export const YEARS_ARR: number[] = [];
for (let i = START_YEAR; i < new Date().getFullYear(); i++) {
    YEARS_ARR.push(i);
}

const STOP_WORDS = ['the', 'and'];

export const SITEMAP_ENTRIES_PER_FILE = 20000; //Google maxes out at 50k, so that's the absolute cap. We'll come in below that.
export const POP_INCREMENT = 0.01; //How much to increase the popularity of a company for 1 action, such as navigating to its page

//Extracted 2022/10/14
export const OSHA_FIELDS = ['id','place','company_name','establishment_name','ein','street_address','city','state','zip_code','naics_code','industry_description','annual_average_employees','total_hours_worked','no_injuries_illnesses','total_deaths','total_dafw_cases','total_djtr_cases','total_other_cases','total_dafw_days','total_djtr_days','total_injuries','total_poisonings','total_respiratory_conditions','total_skin_disorders','total_hearing_loss','total_other_illnesses','establishment_id','establishment_type','size','year_filing_for','created_timestamp','change_reason',];
export const MAIN_FIELDS: (keyof ILocation)[] = ['ein', 'year_filing_for', 'company_name', 'establishment_name', 'street_address', 'city', 'state', 'zip_code', 'annual_average_employees', 'total_hours_worked', 'total_deaths', 'total_dafw_cases', 'total_dafw_days', 'total_djtr_cases', 'total_djtr_days', 'total_injuries', 'total_poisonings', 'total_respiratory_conditions', 'total_skin_disorders', 'total_hearing_loss', 'total_other_illnesses',];
export const INDUSTRY_FIELDS: (keyof Pick<IIndustry, 'naics_code'> | 'industry_description')[] = ['naics_code', 'industry_description',];
export const ARCHIVE_FIELDS: (keyof NonNullable<ILocation['archive']>)[] = ['id', 'no_injuries_illnesses','total_other_cases','establishment_id','establishment_type','size','created_timestamp','change_reason',];

export const SCREEN = {
    sm: 640, //Max-width
    md: 768,
    lg: 1024,
    xl: 1280,
};

export const COLORS = {
    primary: "#3657AD",
    secondary: "#AED2EB",
    zinc50: 'rgb(250 250 250)',
    zinc100: 'rgb(244 244 245)',
    zinc200: 'rgb(228 228 231)',
    zinc300: 'rgb(212 212 216)',
    zinc400: 'rgb(161 161 170)',
    zinc500: 'rgb(113 113 122)',
    zinc600: 'rgb(82 82 91)',
    zinc700: 'rgb(63 63 70)',
    zinc800: 'rgb(39 39 42)',
    zinc900: 'rgb(24 24 27)',
};

export const METRICS: { [key in Metric]: string } = {
    total_incidents: humanizeMetric('total_incidents'),
    total_deaths: humanizeMetric('total_deaths'),
    total_injuries: humanizeMetric('total_injuries'),
    total_dafw_cases: humanizeMetric('total_dafw_cases'),
    total_dafw_days: humanizeMetric('total_dafw_days'),
    total_djtr_cases: humanizeMetric('total_djtr_cases'),
    total_djtr_days: humanizeMetric('total_djtr_days'),
    total_poisonings: humanizeMetric('total_poisonings'),
    total_respiratory_conditions: humanizeMetric('total_respiratory_conditions'),
    total_skin_disorders: humanizeMetric('total_skin_disorders'),
    total_hearing_loss: humanizeMetric('total_hearing_loss'),
    total_other_illnesses: humanizeMetric('total_other_illnesses'),
    trir: humanizeMetric('trir'),
    dart: humanizeMetric('dart'),
}
export const METRIC_NAMES = Object.keys(METRICS) as Metric[];

const NON_ALPHA_NUM_REGEX = /[^ a-z0-9]/gi;
const CHAR_REGICES: { char: (keyof ICharCount), regExp: RegExp }[] = [
    { char: 'a', regExp: /a/gi },
    { char: 'b', regExp: /b/gi },
    { char: 'c', regExp: /c/gi },
    { char: 'd', regExp: /d/gi },
    { char: 'e', regExp: /e/gi },
    { char: 'f', regExp: /f/gi },
    { char: 'g', regExp: /g/gi },
    { char: 'h', regExp: /h/gi },
    { char: 'i', regExp: /i/gi },
    { char: 'j', regExp: /j/gi },
    { char: 'k', regExp: /k/gi },
    { char: 'l', regExp: /l/gi },
    { char: 'm', regExp: /m/gi },
    { char: 'n', regExp: /n/gi },
    { char: 'o', regExp: /o/gi },
    { char: 'p', regExp: /p/gi },
    { char: 'q', regExp: /q/gi },
    { char: 'r', regExp: /r/gi },
    { char: 's', regExp: /s/gi },
    { char: 't', regExp: /t/gi },
    { char: 'u', regExp: /u/gi },
    { char: 'v', regExp: /v/gi },
    { char: 'w', regExp: /w/gi },
    { char: 'x', regExp: /x/gi },
    { char: 'y', regExp: /y/gi },
    { char: 'z', regExp: /z/gi },
    { char: '0', regExp: /0/g },
    { char: '1', regExp: /1/g },
    { char: '2', regExp: /2/g },
    { char: '3', regExp: /3/g },
    { char: '4', regExp: /4/g },
    { char: '5', regExp: /5/g },
    { char: '6', regExp: /6/g },
    { char: '7', regExp: /7/g },
    { char: '8', regExp: /8/g },
    { char: '9', regExp: /9/g },
];

const ALPHABET = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z'];

/**
 * 
 * @param runner Function to call when we need to populate the cache
 * @param ttl Number of milliseconds it should live for
 * @returns [get(), clear()]
 */
function cache<T>(runner: () => Promise<T>, ttl?: number): { get: () => Promise<T>, clear: () => void } {
    const listeners: ((result: T) => void)[] = [];
    let result: T | null = null;
    let lastRun = new Date();
    let inProgress: boolean = false;

    return {
        get: async () => {
            if (!inProgress) {
                if (result == null || new Date().valueOf() - lastRun.valueOf() > (ttl || 10000)) {
                    inProgress = true;
                    runner().then(curResult => {
                        inProgress = false;
                        result = curResult;
                        lastRun = new Date();
                        for (const listener of listeners) {
                            listener(curResult);
                        }
                    });
                } else {
                    return result;
                }            
            }

            const prom = new Promise<T>((resolve, reject) => {
                listeners.push(resolve);
            });
            return prom;
        },
        clear: () => {
            result = null;
        }
    };
}

let nextTooltipID = 0;
const COL_NAME_SIMILARITY_THRESHOLD = 0.92;

export const wsiScoreWeights = cache<IWsiScoreWeights>(() => {
    return getStaticRecord<IWsiScoreWeights>('wsi_score_weights') as Promise<IWsiScoreWeights>;
}, 10000);

export const getNAICSInfo: (code: number | string | undefined, numYears?: number) => Promise<INAICS[string][]>
    = (() => {
        let NAICS: INAICS[] | null = null;

        return async (code: number | string | undefined, numYears?: number) => {
            if (!NAICS) {
                const query = new Query<any>().where([`r.type = 'naics'`]).orderBy('year_filing_for').limit(TOTAL_YEARS);
                NAICS = await getStaticRecord<INAICS[]>(undefined, query) as INAICS[];
            }

            const codeStr = `${code}`;
            const results: INAICS[string][] = [];
            for (let i = 0; i < Math.min(NAICS.length, numYears || 0); i++) {
                /*
                The NAICS code from the OSHA spreadsheet sometimes includes extra numbers at the end.
                I.e., it might be 12345 while the closest NAICS code is 1234.
                It always appears to be a subset like this, so start by searching for the fill code and remove digits from the end until we find a matching NAICS code.
                */
                for (let j = codeStr.length; j >= 1; j--) {
                    if (NAICS[i][codeStr.substring(0, j)]) {
                        results.push({
                            ...NAICS[i][codeStr.substring(0, j)],
                            year_filing_for: NAICS[i].year_filing_for as any,
                        });
                        break;
                    }
                }
            }

            return results;
        };
    }
)();

const NUM_TIERS = [
    {
        num: 1000000000,
        char: 'b'
    },
    {
        num: 1000000,
        char: 'm'
    },
    {
        num: 1000,
        char: 'k'
    },
];
export function abbreviateNum(num: number | string | undefined, force?: boolean): string {
    let newNum = parseFloat(`${num}`);
    if (newNum == null || isNaN(newNum)) {
        return `${num}`;
    }
    
    if (newNum < 10000 && !force) {
        return delimitNum(newNum);
    }

    let decimalPoints = 0;
    if (newNum > 1000000) {
        decimalPoints = 1;
    }

    for (let i = 0; i < NUM_TIERS.length; i++) {
        if (newNum >= NUM_TIERS[i].num) {
            newNum /= NUM_TIERS[i].num;
            if (newNum % 1 == 0) {
                decimalPoints = 0;
            }
            return `${newNum.toFixed(decimalPoints)}${NUM_TIERS[i].char}`;
        }
    }

    return `${num}`;
}

export function delimitNum(num: number | string | undefined): string {
    const str = `${num}`;
    const parsed = parseFloat(str);
    if (parsed == null || isNaN(parsed)) {
        return str;
    }

    const split = str.split('.');
    let integer = split[0];
    const decimal = split[1];

    for (let i = integer.length - 3; i > 0; i -= 3) {
        integer = `${integer.substring(0, i)},${integer.substring(i)}`;
    }

    return integer + (decimal ? `.${decimal.substring(0, 2)}` : '');
}

export function humanizeScoreMetric(m: IWsiScoreFactor['key']): string {
    switch (m) {
        case 'trir':
            return `Incident rate`;
        case 'dart':
            return `DART rating`;
        case 'trir_forecast':
            return `Incident rate forecast`;
        case 'trir_diff_avg':
            return `Incident rate difference from average`;
        case 'dart_diff_avg':
            return `DART difference from average`;
        case 'avg_death_rate':
            return `Death rate`;
        case 'user_reviews':
            return `User reviews`;
    }

    return '';
}

export function humanizeScoreFactor(factor: IWsiScoreFactor): string {
    switch (factor.key) {
        case 'trir':
            return factor.impact >= 0 ? 'No incidents within the past year' : 'Incidents within the past year';
        case 'dart':
            return factor.impact >= 0 ? 'No days away, restricted, and transfer cases within the past year' : 'Days away, restricted, and transfer cases within the past year';
        case 'trir_forecast':
            return `Incidents trending ${factor.impact > 0 ? 'down' : 'up'}`;
        case 'trir_diff_avg':
            return `Incident rate ${factor.impact > 0 ? 'better' : 'worse'} than industry average`;
        case 'dart_diff_avg':
            return `DART rate ${factor.impact > 0 ? 'better' : 'worse'} than industry average`;
        case 'avg_death_rate':
            if (factor.impact > 0) {
                return `Below-average fatality rate`;
            } else {
                return `Fatalities within the past 3 years`;
            }
        case 'user_reviews':
            return `${factor.impact > 0 ? 'Positive' : 'Negative'} user reviews`;
    }

    return '';
}

export function humanizeScore(score: number | undefined): string {
    if (score == null) {
        return '';
    }

    let superlative = '';
    if (score >= 90) {
        superlative = 'an excellent';
    } else if (score >= 80) {
        superlative = 'a good';
    } else if (score >= 70) {
        superlative = 'a moderate';
    } else if (score >= 50) {
        superlative = 'a poor';
    } else {
        superlative = 'a very poor';
    }
    return `This organization has ${superlative} score`;
}

export function humanizeMetric(m: Metric, capitalize?: boolean): string {
    let metric = '';

    switch(m as Metric & 'user_rating') {
        case 'total_incidents':
            metric = 'Incidents';
            break;
        case 'total_deaths':
            metric = 'Deaths';
            break;
        case 'total_injuries':
            metric = 'Injuries';
            break;
        case 'total_dafw_cases':
        case 'total_dafw_days':
            metric = 'Days away from work';
            break;
        case 'total_djtr_cases':
        case 'total_djtr_days':
            metric = 'Job transfers';
            break;
        case 'total_poisonings':
            metric = 'Poisonings';
            break;
        case 'total_respiratory_conditions':
            metric = 'Respiratory conditions';
            break;
        case 'total_skin_disorders':
            metric = 'Skin disorders';
            break;
        case 'total_hearing_loss':
            metric = 'Hearing loss';
            break;
        case 'total_other_illnesses':
            metric = 'Other illnesses';
            break;
        case 'user_rating':
            metric = 'Community rating';
            break;
        case 'trir':
            metric = 'Incident rate';
            break;
        case 'dart':
            metric = 'DART';
            break;
    }
    
    if (capitalize == false) {
        metric = metric.toLocaleLowerCase();
    }

    return metric;
}

/**
 * Humanize industry
 * @param industry Industry to humanize
 * @param numChars Maximum number of characters to return in string. -1 = full string.
 * @returns Human-readable industry name
 */
export function humanizeIndustry(industry?: IIndustry, numChars?: number): string {
    if (!numChars) {
        numChars = 30;
    } else if (numChars == -1 && industry?.caption) {
        numChars = industry?.caption?.length;
    }

    if (industry?.caption) {
        return `${industry.caption.substring(0, numChars)}${industry.caption.length > numChars ? '...' : ''}`;
    } else {
        return '';
    }
}

export function getTimestampFromYear(year: number): number {
    return new Date(year, 0, 1).valueOf();
}

export function tokenizeString(str: string): string[] {
    str = str.toLocaleLowerCase();
    str = str.replaceAll(NON_ALPHA_NUM_REGEX, ' ');
    const split = str.split(' ').filter(s => s); //Remove empty entries
    
    //Remove duplicates
    for (let i = split.length - 1; i >= 0; i--) {
        if (split.findIndex(s => s == split[i]) != i) {
            split.splice(i, 1);
        }
    }
    
    return split;
}

export function tokenizeBiz(biz: IBiz): string[] {
    let entries = [biz.company_name, biz.industry?.caption, biz.ein,];
    
    if ((biz as ICompany).eins?.length) {
        entries = entries.concat((biz as ICompany).eins);
    } else if ((biz as ILocation).establishment_name) {
        entries.push((biz as ILocation).establishment_name);
        entries.push((biz as ILocation).city);
        entries.push((biz as ILocation).state);
    }

    const tokens = tokenizeString(entries.filter(e => e).join(' ')).filter(t => !STOP_WORDS.includes(t));

    tokens.unshift(tokens.join(' ')); //Add full string as the first element
    return tokens;
}


export function generateCharCount(str: string): ICharCount {
    const charCount = Defaults.ICharCount();
    CHAR_REGICES.forEach(c => {
        charCount[c.char] = str.match(c.regExp)?.length || 0;
    });
    return charCount;
}

export function getUrlParam(param: string): string {
    let val: string | null = null;
    if (typeof window != 'undefined' && window.location.search) {
        const params = new URLSearchParams(window.location.search);
        val = params.get(param);
    }
    return val || '';
}

export function UUID(): string {
    return v4();
}

export function showTooltip(msg: string | Element, anchor?: Element | null, duration?: number): number {
    const MARGIN = 10; //px
    const id = Math.max(0, nextTooltipID++);
    let isToast = !anchor;

    const el = document.createElement('div');
    el.id = `tooltip-${id}`;
    el.className = '_tooltip max-w-[400px] px-6 py-4 bg-secondary text-lg text-zinc-900 text-center rounded shadow-lg z-[1001] transition-all duration-500';

    if (isToast) {
        el.className += ' _toast fixed w-[400px] -bottom-20 left-[calc(50%_-_200px)]';
    } else {
        el.className += ' absolute';
    }

    if (typeof msg == 'string') {
        el.textContent = msg;
    } else {
        el.appendChild(msg);
    }
    
    document.body.appendChild(el);

    el.addEventListener('contextmenu', e => {
        e.preventDefault();
        hideTooltip(id);
    });

    let hovered = false;
    el.addEventListener('mouseover', () => {
        hovered = true;
    });
    el.addEventListener('mouseout', () => {
        hovered = false;
    });
    window.setTimeout(() => {
        const timer = window.setInterval(() => {
            if (!hovered) {
                window.clearInterval(timer);
                hideTooltip(id);
            }
        }, 1000);
    }, duration ? duration - 1000 : 2500);
    
    if (isToast) {
        window.setTimeout(() => {
            el.classList.remove('-bottom-20');
            el.classList.add('bottom-2');
        }, 0);
    } else {
        window.setTimeout(() => {
            const rect = anchor!.getBoundingClientRect();
    
            if (window.innerHeight - (rect.bottom + MARGIN) - el.clientHeight >= 0) {
                el.style.top = `${rect.bottom + MARGIN}px`;
                el.style.left = `${Math.max(0, rect.left + (anchor!.clientWidth - el.clientWidth) / 2)}px`;
            } else if (rect.top + el.clientHeight + MARGIN >= 0) {
                el.style.bottom = `${rect.top - MARGIN}px`;
                el.style.left = `${Math.max(0, rect.left + (anchor!.clientWidth - el.clientWidth) / 2)}px`;
            } else {
                //Panic!
                //Or maybe show as toast?
            }
        }, 0);
    }

    return id;
}

export function hideTooltip(n: number): void {
    const el = document.querySelector(`#tooltip-${n}`);
    if (el) {
        if (el.classList.contains('_toast')) {
            el.classList.remove('bottom-2');
            el.classList.add('-bottom-20');
        }

        el.classList.add('opacity-0');
        el.classList.add('pointer-events-none');
        window.setTimeout(() => {
            document.body.removeChild(el);
        }, 500);
    }
}

export function sortBy(fieldName: string) {
    return (a: any, b: any) => {
        if (a[fieldName] > b[fieldName]) {
            return 1;
        } else if (b[fieldName] > a[fieldName]) {
            return -1;
        } else {
            return 0;
        }
    };
}

export function coerceString(v: any): string | undefined {
    return v != null ? `${v}`.trim() : undefined;
}

export function coerceNumber(v: any): number | undefined {
    if (v == null) {
        return;
    }

    const parsed = parseInt(`${v}`.trim());
    return isNaN(parsed) ? undefined : parsed;
}

export async function openCSVBlob(blobUrl: string): Promise<CSVRow[]> {
    try {
        const downloadResponse = await getUploadsBlobContainer().getBlockBlobClient(blobUrl).download();
        const pipe = new PassThrough();
        downloadResponse.readableStreamBody?.pipe(pipe);
        return neatCsv(pipe);
    } catch (ex) {
        throw `Error reading blob stream into exceljs:\t${ex}`;
    }
}

export async function generateOshaFieldMaps(sheet: CSVRow[]): Promise<Omit<Payloads.IFieldMaps, 'filename'>> {
    return new Promise(async (resolve, reject) => {
        if (sheet.length == 0) {
            return reject(`No rows in csv worksheet`);
        }

        const mainFieldMap: Payloads.IFieldMaps['main'] = {};
        const industryFieldMap: Payloads.IFieldMaps['industry'] = {};
        const archiveFieldMap: Payloads.IFieldMaps['archive'] = {};
        const unusedFieldAssignments: Payloads.IFieldMaps['unusedFields'] = [];
        
        Object.keys(sheet[0]).forEach((val, colIdx) => {
            const mainIdx = MAIN_FIELDS.findIndex(f => fsm(f, val) >= COL_NAME_SIMILARITY_THRESHOLD);
            const industryIdx = INDUSTRY_FIELDS.findIndex(f => fsm(f, val) >= COL_NAME_SIMILARITY_THRESHOLD);
            const archiveIdx = ARCHIVE_FIELDS.findIndex(f => fsm(f, val) >= COL_NAME_SIMILARITY_THRESHOLD);

            if (mainIdx > -1) {
                mainFieldMap[MAIN_FIELDS[mainIdx]] = val as typeof OSHA_FIELDS[number];
            } else if (industryIdx > -1) {
                industryFieldMap[INDUSTRY_FIELDS[industryIdx]] = val as typeof OSHA_FIELDS[number];
            } else if (archiveIdx > -1) {
                archiveFieldMap[ARCHIVE_FIELDS[archiveIdx]] = val as typeof OSHA_FIELDS[number];
            } else {
                unusedFieldAssignments.push(val);
            }
        });

        resolve({
            main: mainFieldMap,
            industry: industryFieldMap,
            archive: archiveFieldMap,
            unusedFields: unusedFieldAssignments,
        });
    });
}

export function flattenBusinesses(businesses: IBiz[]): IBiz_Flattened[] {
    const rows: IBiz_Flattened[] = [];

    for (const biz of businesses) {
        const mainFields: any = {};
        for (const key of MAIN_FIELDS) {
            mainFields[key] = (biz as ILocation)[key] != null ? (biz as ILocation)[key] : undefined;
        }
        
        const archiveFields: any = {};
        if (biz.archive) {
            for (const key of ARCHIVE_FIELDS) {
                archiveFields[key] = biz.archive[key] != null ? biz.archive[key] : undefined;
            }
        }
        
        const industryFields: any = {};
        if (biz.industry) {
            for (const key of INDUSTRY_FIELDS) {
                if (key == 'naics_code') {
                    industryFields[key] = biz.industry.naics_code;
                } else if (key == 'industry_description') {
                    industryFields[key] = biz.industry.caption;
                }
            }
        }

        rows.push({
            place: biz.place,
            ...mainFields,
            ...archiveFields,
            ...industryFields,
        });
    }

    return rows;
}

export function calcTrir(biz: IBiz): number {
    return biz.total_hours_worked && biz.total_injuries * 200000 / biz.total_hours_worked || 0;
}

export function calcDart(biz: IBiz): number {
    return biz.total_hours_worked && (biz.total_dafw_cases + biz.total_djtr_cases) * 200000 / biz.total_hours_worked || 0;
}

export function calcAvgWorkWeek(biz: IBiz): number | undefined {
    let avgWorkWeek: number | undefined = undefined;
    if (biz.annual_average_employees && biz.total_hours_worked) {
        avgWorkWeek = biz.avg_work_week = Math.round(biz.total_hours_worked / biz.annual_average_employees / 52.14);
    }
    return avgWorkWeek;
}

export function getId(p: ICompany | ILocation): string {
    if ((p as ILocation).locationId) {
        return `loc-${(p as ILocation).locationId}-${p.year_filing_for}`;
    } else {
        return `company-${p.place}-${p.year_filing_for}`;
    }
}

export function pluralize(str: 'company' | 'location' | 'employee' | 'incident' | 'year' | 'review' | 'result', num: number | undefined): string {
    switch (str) {
        case 'company':
            return num == 1 ? 'company' : 'companies';
        case 'location':
            return num == 1 ? 'location' : 'locations';
        case 'employee':
            return num == 1 ? 'employee' : 'employees';
        case 'incident':
            return num == 1 ? 'incident' : 'incidents';
        case 'year':
            return num == 1 ? 'year' : 'years';
        case 'review':
            return num == 1 ? 'review' : 'reviews';
        case 'result':
            return num == 1 ? 'result' : 'results';
    }
}

/**
 * Calculate WSI score for a biz
 * @param company The company to calculate a score for
 */
export async function calcWsiScore(company: ICompany, weights?: IWsiScoreWeights, naics?: INAICS[string][], includeAllFactors?: boolean): Promise<ICompany['wsi_score']> {
    weights = weights || await wsiScoreWeights.get();

    let factors: { key: keyof IWsiScoreWeights, impact: number }[] = [];

    const trir = weights.trir * company.trir;
    factors.push({
        key: 'trir',
        impact: -1 * Math.min(weights.trir * weights.maxMultiplier, trir),
    });

    const dart = weights.dart * company.dart;
    factors.push({
        key: 'dart',
        impact: -1 * Math.min(weights.dart * weights.maxMultiplier, dart),
    });

    if (company.past_averages) {
        const trirForecast = weights.trir_forecast * forecastLinearRegression([[0, company.past_averages.trir], [1, company.trir]], 2);
        factors.push({
            key: 'trir_forecast',
            impact: -1 * Math.min(weights.trir_forecast * weights.maxMultiplier, trirForecast - (company.past_averages.trir + company.trir) / 2),
        });

        if (company.industry?.naics_code) {
            naics = naics || await getNAICSInfo(company.industry.naics_code, 3);

            if (naics.length > 0) {
                if (naics.filter(n => n.trir != null).length == naics.length) {
                    const trirDiffAvg = weights.trir_diff_avg * ((company.past_averages.trir * 2 + company.trir) / 3 - naics.reduce((sum, cur) => sum + cur.trir!, 0) / naics.length);
                    factors.push({
                        key: 'trir_diff_avg',
                        impact: -1 * Math.min(weights.trir_diff_avg * weights.maxMultiplier, trirDiffAvg),
                    });
                }
                
                if (naics.filter(n => n.dart != null).length == naics.length) {
                    const dartDiffAvg = weights.dart_diff_avg * ((company.past_averages.dart * 2 + company.dart) / 3 - naics.reduce((sum, cur) => sum + cur.dart!, 0) / naics.length);
                    factors.push({
                        key: 'dart_diff_avg',
                        impact: -1 * Math.min(weights.dart_diff_avg * weights.maxMultiplier, dartDiffAvg),
                    });
                }
            }
        }
    }

    let avgDeathRate = weights.avg_death_rate * ((company.past_averages || company).total_deaths * 2 + company.total_deaths) / 3 * 2000000 / company.total_hours_worked;
    if (isNaN(avgDeathRate)) {
        avgDeathRate = 0;
    }
    factors.push({
        key: 'avg_death_rate',
        impact: -1 * Math.min(weights.avg_death_rate * weights.maxMultiplier, avgDeathRate),
    });

    if (company.average_review != null) {
        const userReviews = weights.user_reviews * (4 - company.average_review!); //Difference from '4' (treating '4' as the average review, essentially)
        factors.push({
            key: 'user_reviews',
            impact: -1 * Math.min(weights.user_reviews * weights.maxMultiplier, userReviews),
        });
    }

    const score = Math.max(4, Math.min(100, Math.floor(100 + factors.reduce((prev, cur) => prev + cur.impact, 0))));
    let positives: IWsiScoreFactor[] = [];
    let negatives: IWsiScoreFactor[] = [];
    for (const factor of factors) {
        if (factor.impact > 0) {
            positives.push(factor);
        } else if (factor.impact < 0) {
            negatives.push(factor);
        }
    }
    
    positives.sort(sortByImpact);
    negatives.sort(sortByImpact);

    const TRIR_NO_OVERLAP: (keyof IWsiScoreWeights)[] = ['trir', 'trir_diff_avg'];
    if (positives.some(p => TRIR_NO_OVERLAP.includes(p.key))) {
        negatives = negatives.filter(n => !TRIR_NO_OVERLAP.includes(n.key));
    }
    const DART_NO_OVERLAP: (keyof IWsiScoreWeights)[] = ['dart', 'dart_diff_avg'];
    if (positives.some(p => DART_NO_OVERLAP.includes(p.key))) {
        negatives = negatives.filter(n => !DART_NO_OVERLAP.includes(n.key));
    }

    if (score >= 90) {
        positives = positives.slice(0, 4);
        negatives = [];
    } else if (score >= 80) {
        positives = positives.slice(0, 3);
        negatives = negatives.slice(0, 1);
    } else if (score >= 70) {
        positives = positives.slice(0, 2);
        negatives = negatives.slice(0, 2);
    } else if (score >= 50) {
        positives = positives.slice(0, 1);
        negatives = negatives.slice(0, 3);
    } else {
        positives = [];
        negatives = negatives.slice(0, 4);
    }

    return {
        score,
        positives,
        negatives,
        allFactors: includeAllFactors ? factors.reduce((prev, cur) => { prev[cur.key] = cur.impact; return prev; }, {} as IWsiScoreWeights) : undefined
    };
}

function sortByImpact(a: IWsiScoreFactor, b: IWsiScoreFactor) {
    if (Math.abs(a.impact) > Math.abs(b.impact)) {
        return -1;
    } else if (Math.abs(a.impact) < Math.abs(b.impact)) {
        return 1;
    } else {
        return 0;
    }
}

export function forecastLinearRegression(points: number[][], x: number): number {
    if (points.length == 1) {
        return points[0][1];
    }

    //Using formula from https://www.vedantu.com/maths/linear-regression (a well-known formula; it's the same anywhere)
    let sumX = 0;
    let sumX2 = 0;
    let sumXY = 0;
    let sumY = 0;
    for (let point of points) {
        sumX += point[0];
        sumX2 += Math.pow(point[0], 2);
        sumXY += point[0] * point[1];
        sumY += point[1];
    }
    
    const m = (points.length * sumXY - sumX * sumY) / (points.length * sumX2 - Math.pow(sumX, 2));
    const b = (sumY * sumX2 - sumX * sumXY) / (points.length * sumX2 - Math.pow(sumX, 2));
    return m * x + b;
}

export function showImagePicker(): Promise<string | null> {
    const prom = new Promise<string | null>((resolve, reject) => {
        const el = document.createElement('input');
        el.id = 'img-picker';
        el.type = 'file';
        el.accept = 'image/*';
        el.className = 'hidden';

        el.addEventListener('change', e => {
            const files = (e.target as HTMLInputElement).files;
            if (files && files[0]) {
                try {
                    if (files[0].size > 10 * Math.pow(1024, 2)) {
                        showTooltip('Image must be under 10 MB');
                        reject('Image file is above 10 MB');
                        return;
                    }
    
                    const reader = new FileReader();
                    reader.addEventListener('load', e => {
                        resolve(e.target?.result as string);
                    });
    
                    reader.readAsDataURL(files[0]);
                } catch (ex) {
                    reject('Unknown error');
                }
            }
        });

        document.body.appendChild(el);
        el.click();
    
        const onWindowFocus = () => { //Fires after file select dialog closes, to check if they cancelled instead of seleceting a file
            window.setTimeout(() => {
                if (el) {
                    if (!el.files || el.files!.length == 0) {
                        reject('No files selected');
                    }
                }

                window.removeEventListener('focus', onWindowFocus);
            }, 500);
        };
        window.addEventListener('focus', onWindowFocus);
    });
    
    document.body.removeChild(document.querySelector('#img-picker')!);
    
    return prom;
}

export function resizeImg(imgSrc: string, maxWidth?: number, maxHeight?: number, size?: 'cover' | 'contain'): Promise<string> {
    return new Promise<string>((resolve, reject) => {
        try {
            const img = new Image;
            img.onload = () => {
                if (!maxWidth && !maxHeight) {
                    maxWidth = 400;
                    maxHeight = 600;
                }

                const proportion = img.width / img.height;
                let w: number;
                let h: number;
                if (!maxWidth) {
                    h = maxHeight!;
                    w = h * proportion;
                } else if (!maxHeight) {
                    w = maxWidth!;
                    h = w / proportion;
                } else {
                    if (maxWidth / proportion <= maxHeight) {
                        w = maxWidth;
                        h = w / proportion;
                    } else {
                        h = maxHeight;
                        w = h * proportion;
                    }
                }
                
                const canvas = document.createElement('canvas');
                if (size == 'cover' && maxWidth && maxHeight) {
                    canvas.width = maxWidth;
                    canvas.height = maxHeight;
                } else {
                    canvas.width = w;
                    canvas.height = h;
                }
                const ctx = canvas.getContext('2d');
                
                if (maxWidth && maxHeight && size == 'cover') {
                    if (w < maxWidth) {
                        w = maxWidth;
                        h = w / proportion;
                    }
                    if (h < maxHeight) {
                        h = maxHeight;
                        w = h * proportion;
                    }
                }

                ctx!.drawImage(img, (canvas.width - w) / 2, (canvas.height - h) / 2, w, h);
                resolve(canvas.toDataURL());
            }

            img.src = imgSrc;
        } catch (ex) {
            reject(ex);
        }
    });
}

export function getRevalidateUrls(biz: IBiz | IBiz_Flattened): string[] {
    const urls: string[] = [];

    urls.push(`/summary/${biz.place}`);
    
    if ((biz as ILocation).establishment_name) { //ILocation
        urls.push(`/location/${(biz as ILocation).locationId || (biz as IBiz_Flattened).establishment_id}`);
    }

    return urls;
}

export namespace Defaults {
    export function ICharCount(): ICharCount {
        return {
            'a': 0,
            'b': 0,
            'c': 0,
            'd': 0,
            'e': 0,
            'f': 0,
            'g': 0,
            'h': 0,
            'i': 0,
            'j': 0,
            'k': 0,
            'l': 0,
            'm': 0,
            'n': 0,
            'o': 0,
            'p': 0,
            'q': 0,
            'r': 0,
            's': 0,
            't': 0,
            'u': 0,
            'v': 0,
            'w': 0,
            'x': 0,
            'y': 0,
            'z': 0,
            '0': 0,
            '1': 0,
            '2': 0,
            '3': 0,
            '4': 0,
            '5': 0,
            '6': 0,
            '7': 0,
            '8': 0,
            '9': 0,
        };
    }

    export function BizMetrics(): BizMetrics {
        return {
            total_incidents: 0,
            total_deaths: 0,
            total_injuries: 0,
            total_dafw_cases: 0,
            total_dafw_days: 0,
            total_djtr_cases: 0,
            total_djtr_days: 0,
            total_poisonings: 0,
            total_respiratory_conditions: 0,
            total_skin_disorders: 0,
            total_hearing_loss: 0,
            total_other_illnesses: 0,
            trir: 0,
            dart: 0,
        };
    }

    export function ICompany(): ICompany {
        return {
            id: UUID(),
            place: '',
            version: 1,
            created: new Date().toISOString(),
            isLatest: true,
            tokenized: [],
            tokenizedCompanyName: [],
            charCount: Defaults.ICharCount(),
            year_filing_for: 0,
            company_name: '',
            num_locations: 0,
            annual_average_employees: 0,
            total_hours_worked: 0,
            avg_work_week: 0,
            eins: [],
            industries: [],
            num_reviews: 0,
            popularity: 0,
            averages_per_loc: Defaults.BizMetrics(),
            ...Defaults.BizMetrics(),
        };
    }
    
    export function ILocation(): ILocation {
        return {
            id: UUID(),
            place: '',
            version: 1,
            created: new Date().toISOString(),
            isLatest: true,
            tokenized: [],
            tokenizedCompanyName: [],
            charCount: Defaults.ICharCount(),
            company_name: '',
            year_filing_for: 0,
            annual_average_employees: 0,
            total_hours_worked: 0,
            avg_work_week: 0,
            parent: '',
            locationId: '',
            ...Defaults.BizMetrics(),
        };
    }
}

export namespace DBTypes {
    export type SearchMode =
        'search' //Default. Search for businesses using a search string.
        | 'paginate' //Get additional pages of results from a previous search.
        | 'related'; //Get related items from a previous search.
    
    export type SearchSort = 'relevance' | 'safety';
    
    export interface ISearchOps {
        search: string | ISearchRecord['id'];
        mode: SearchMode;
        omit?: IBiz['place'][];
        sort?: SearchSort;
        offset?: number;
        limit?: number;
    }
    export interface ISearchResult {
        results: ICompany_Search[],
        totalCount: number,
        searchId: ID,
        hasMore: boolean,
    }
    export type Search = (ops: ISearchOps) => Promise<ISearchResult>;
    
    /**
     * Requires locationId or relatedTo
     */
    export type GetLocations = (ops: {
        ids?: ILocation['id'][];
        locationId?: ILocation['locationId'],
        relatedTo?: Pick<ICompany, 'id'> | Pick<ILocation, 'place' | 'locationId' | 'parent' | 'year_filing_for'>,
        search?: string, //Filter down results
        project?: (keyof ILocation)[],
        orderBy?: (keyof ILocation),
        order?: 'ASC' | 'DESC',
        offset?: number,
        limit?: number,
    }) => Promise<ILocation[]>;
    
    /**
     * Requires id, place, relatedTo, or preset
     */
    export type GetCompanies = (ops: {
        id?: ID,
        place?: string,
        relatedTo?: ICompany,
        preset?: 'mostPopular' | 'safest',
        naics_code?: number,
        limit?: number,
    }) => Promise<ICompany[]>;

    export type GetFileNames = (ops: { prefix: string }) => Promise<string[]>;
}

export namespace Payloads {
    export interface IVerifyImport {
        filename: string;
    }

    export interface IFieldMaps {
        main: { [wsiKey in keyof Partial<ILocation>]: typeof OSHA_FIELDS[number] };
        industry: Partial<{ [wsiKey in keyof Pick<IIndustry, 'naics_code'> | 'industry_description']: typeof OSHA_FIELDS[number] }>;
        archive: { [wsiKey in keyof Partial<NonNullable<ILocation['archive']>>]: typeof OSHA_FIELDS[number] };
        unusedFields: string[];
        filename: IVerifyImport['filename'];
    }
    
    export interface IFinishImport extends Partial<IVerifyImport> {
        //Will either load records from 'filename' OR re-import 'locs'
        
        locs?: ILocation[];
        nonce?: ID;
        totalTasks?: number;
        completedTasks?: number;
        task?: string;

        skipLocations?: boolean; //Set to 'true' if you only want to import companies. It will still parse all locations to build companies, but won't push any locations to the DB.
    }

    export interface IDownloadRequest {
        companies?: ICompany['id'][];
        locations?: ILocation['id'][];
    }
    
    export interface IDownloadResponse {
        filename: string;
    }

    export interface IEditCompanies {
        companies: ICompany[];
        merge?: ICompany[];
    }

    export interface INAICS {
        code: Parameters<typeof getNAICSInfo>[0];
        numYears?: number;
    }

    export interface IScoreCalcRequest {
        nonce?: string;
        weights?: IWsiScoreWeights;
    }

    export interface IProgressResponse {
        nonce: string;
        completed: number;
        total: number;
    }

    export interface IMergeLocations {
        ids: ILocation['id'][];
    }

    export interface IReportError {
        id: ID;
        date: ISODate;
        url: string;
        msg: string;
        
        userAgent: string;
        deviceW: number;
        deviceH: number;
    }
}

export class Query<T> {
    _select: (keyof T)[]; //Array of field names. I.e., ['name', 'id']
    _where: string[]; //Array of conditions. I.e., ["r.name = 'target'", "r.parent = null"]
    _orderBy: (keyof T)[] | null; //Field name
    _order: 'ASC' | 'DESC'; //Default: 'DESC'
    _offset: number | null;
    _limit: number | null;
    _distinct: boolean;
    _value: boolean;
    _params: (number | string)[] = [];

    constructor(select?: (keyof T)[], where?: string[], orderBy?: keyof T, order?: 'ASC' | 'DESC', offset?: number, limit?: number) {
        this._select = select || [];
        this._where = where || [];
        this._orderBy = orderBy ? [orderBy] : null;
        this._order = order || 'DESC';
        this._offset = offset != null ? offset : null;
        this._limit = limit != null ? limit : null;
        this._distinct = false;
        this._value = false;
    }

    select(select: keyof T | (keyof T)[]): Query<T> {
        if (!Array.isArray(select)) {
            this._select = [select];
        } else {
            this._select = select;
        }
        return this;
    }
    addSelect(s: keyof T | (keyof T)[]): Query<T> {
        if (!Array.isArray(s)) {
            s = [s];
        }
        this._select = this._select.concat(s as (keyof T)[]);
        return this;
    }

    where(where: string | string[]): Query<T> {
        if (!Array.isArray(where)) {
            where = [where];
        }
        this._where = where;
        return this;
    }
    addWhere(w: string | string[]): Query<T> {
        if (!Array.isArray(w)) {
            w = [w];
        }
        this._where = this._where.concat(w as string[]);
        return this;
    }
    removeWhere(where: string): Query<T> {
        const idx = this._where.findIndex(w => w.includes(where));
        if (idx > -1) {
            this._where.splice(idx, 1);
        }
        return this;
    }

    orderBy(orderBy: keyof T | (keyof T)[]): Query<T> {
        if (!Array.isArray(orderBy)) {
            this._orderBy = [orderBy as keyof T];
        } else {
            this._orderBy = orderBy as (keyof T)[];
        }
        return this;
    }

    order(order: 'ASC' | 'DESC'): Query<T> {
        this._order = order;
        return this;
    }

    offset(offset: number): Query<T> {
        this._offset = offset;
        return this;
    }

    limit(limit: number): Query<T> {
        this._limit = limit;
        return this;
    }

    distinct(d: boolean): Query<T> {
        this._distinct = d;
        return this;
    }
    
    value(d: boolean): Query<T> {
        this._value = d;
        return this;
    }

    toString() {
        const select = `SELECT ${this._distinct ? 'DISTINCT' : ''} ${this._value ? 'VALUE' : ''} ${this._select.length ? this._select.filter(s => s).map(s => `r.${s as string}`).join(', ') : '*'}`;
        const where = this._where.length ? `WHERE ${this._where.filter(w => w).join(' AND ')}` : '';
        const orderBy = this._orderBy?.length ? `ORDER BY ${this._orderBy.map(o => `r.${o as string}${` ${this._order}` || ''}`).join(', ')}` : '';
        const offset = (this._offset != null || this._limit != null) ? `OFFSET ${this._offset || 0}` : '';
        const limit = (this._offset != null || this._limit != null) ? `LIMIT ${this._limit || 10}` : '';

        const q = `${select} FROM r ${where} ${orderBy} ${offset} ${limit}`;
        return q;
    }

    toJson(): IQuery {
        return {
            select: this._select,
            where: this._where,
            orderBy: this._orderBy,
            order: this._order,
            offset: this._offset,
            limit: this._limit,
            params: this._params,
        };
    }

    toSql(): SqlQuerySpec {
        return {
            query: this.toString(),
            parameters: this.listParams(),
        }
    }

    fromJson(json: IQuery): Query<T> {
        this._select = json.select;
        this._where = json.where;
        this._orderBy = json.orderBy;
        this._order = json.order;
        this._offset = json.offset;
        this._limit = json.limit;
        this._params = json.params;
        return this;
    }

    addParam(v: number | string): string {
        this._params.push(v);
        return `@${this.getParamKey(this._params.length - 1)}`;
    }

    listParams(): { name: string, value: number | string }[] {
        return this._params.map((v, idx) => ({
            name: `@${this.getParamKey(idx)}`,
            value: v,
        }));
    }

    private getParamKey(i: number) {
        let key = '';
        while (i >= ALPHABET.length) {
            key += ALPHABET[0];
            i -= ALPHABET.length;
        }
        key += ALPHABET[i % ALPHABET.length];
        return key;
    }
}

interface IQuery {
    select: any[]; //Array of field names. I.e., ['name', 'id']
    where: string[]; //Array of conditions. I.e., ["r.name = 'target'", "r.parent = null"]
    orderBy: any | null; //Field name
    order: 'ASC' | 'DESC'; //Default: 'DESC'
    offset: number | null;
    limit: number | null;
    params: (number | string)[];
}

export class Logger {
    _start = new Date();
    _cur = new Date();

    log(...s: string[]) {
        const now = new Date();
        console.log(`[${(now.valueOf() - this._cur.valueOf()) / 1000}s]`, ...s);
        this._cur = now;
    }

    end(...s: string[]) {
        this._cur = this._start;
        this.log(...s);
    }
}

export type ID = string;
export type Metric = 'total_incidents' | 'total_deaths' | 'total_injuries' | 'total_dafw_cases' | 'total_dafw_days' | 'total_djtr_cases' | 'total_djtr_days' | 'total_poisonings' | 'total_respiratory_conditions' | 'total_skin_disorders' | 'total_hearing_loss' | 'total_other_illnesses' | 'trir' | 'dart';
export type BizMetrics = Record<Metric, number>;
export type RelativeQuantity = 'none' | 'few' | 'some' | 'many' | 'low' | 'high';
export type ISODate = string; //ISO format

export interface IIndustry {
    naics_code?: number;
    caption?: string;
};

export interface IBiz extends BizMetrics {
    id: ID;
    place: string; //Umbrella id shared between all locations and all years for this business. Attempts to be human-readable. E.g., 'target'
    version: number; //Schema version for tracking what fields we can expect in this location
    created: ISODate; //When this record was added to our DB
    isLatest: boolean;
    
    //Used for search
    tokenized: string[]; //Sanitized strings containing name, place, etc.
    tokenizedCompanyName: string[]; //Not currently in use. Could make search better (i.e., first page of results only matches on company name).
    charCount: ICharCount; //# of times each letter & number appears in the full tokenized string. Used for incomplete word matching.
    
    industry?: IIndustry;
    ein?: string;
    year_filing_for: number; //E.g., 2021
    
    company_name: string; //E.g., Target
    street_address?: string;
    city?: string;
    state?: string;
    zip_code?: number;
    
    annual_average_employees: number;
    total_hours_worked: number;
    avg_work_week?: number;
    past_averages?: BizMetrics; //Average of all years leading up to (but not including) the current year

    //===== Fields we'll keep but aren't curretly using =====
    archive?: {
        id?: string;
        no_injuries_illnesses?: number;
        total_other_cases?: number;
        establishment_id?: string;
        establishment_type?: number;
        size?: number;
        created_timestamp?: string;
        change_reason?: string;
    };
}

export type IBiz_Flattened = { [key in typeof OSHA_FIELDS[number]]: string };

// ICompany is for umbrella locations (aggregates all locations for a given business)
export interface ICompany extends IBiz {
    eins: IBiz['ein'][];
    industries: (IIndustry & { annual_average_employees: number })[]; //All industries represented in this company

    website?: string; //E.g., www.target.com
    logo?: {
        h96?: string; //www.images.com/img.jpeg
    };
    headerImg?: {
        h200?: string; //www.images.com/img.jpeg
    };

    num_locations: number;
    averages_per_loc: BizMetrics;

    num_reviews: number;
    average_review?: number; //Average of all user reviews
    popularity: number; //A wsi-internal score
    wsi_score?: IWsiScore;
}
export type ICompany_Search = Pick<ICompany, 'id' | 'place' | 'year_filing_for' | 'popularity' | 'company_name' | 'industry' | 'logo' | 'num_locations' | 'annual_average_employees' | 'total_incidents' | 'num_reviews' | 'average_review' | 'wsi_score' | 'tokenized'>;

export interface ILocation extends IBiz {
    parent: ID;
    locationId: ID; //Consistent ID that persists across all years for a single location
    establishment_name?: string; //E.g., 0001 - Minneapolis
}

export interface IIndustryInfo {
    id: ID;
    naics_code: NonNullable<IIndustry['naics_code']>;
    captions: NonNullable<IIndustry['caption']>[];
    year_filing_for: number;
    num_locations: number; //Total number of businesses in this industry for this year
    averages: BizMetrics & {
        wsi_score?: number;
    };
    version: number;
}

export interface IWsiScore {
    score: number;
    positives: IWsiScoreFactor[];
    negatives: IWsiScoreFactor[];

    allFactors?: Omit<IWsiScoreWeights, 'maxMultiplier'>;
}

export interface ISeriesPoint {
    x: number;
    y: number;
    label: string;
    xOffset: number;
    yOffset: number;
}

export interface ISearchRecord extends DBTypes.ISearchOps {
    id: ID;
    query: IQuery;
    results: Pick<ICompany_Search, 'id' | 'place' | 'annual_average_employees'>[];
    date: ISODate;
}

export interface ICharCount {
    'a': number;
    'b': number;
    'c': number;
    'd': number;
    'e': number;
    'f': number;
    'g': number;
    'h': number;
    'i': number;
    'j': number;
    'k': number;
    'l': number;
    'm': number;
    'n': number;
    'o': number;
    'p': number;
    'q': number;
    'r': number;
    's': number;
    't': number;
    'u': number;
    'v': number;
    'w': number;
    'x': number;
    'y': number;
    'z': number;
    '0': number;
    '1': number;
    '2': number;
    '3': number;
    '4': number;
    '5': number;
    '6': number;
    '7': number;
    '8': number;
    '9': number;
}

export interface INAICS {
    [naics_codes: string]: {
        year_filing_for: number;
        caption: string;
        trir?: number;
        dart?: number;
    }
}

export interface IWsiScoreWeights {
    trir: number;
    trir_forecast: number;
    trir_diff_avg: number;
    dart: number;
    dart_diff_avg: number;
    avg_death_rate: number;
    user_reviews: number;
    is_engaged: number;
    engagement_rel: number;

    maxMultiplier: number;
}

interface IWsiScoreFactor {
    key: keyof IWsiScoreWeights;
    impact: number; //Positive is good
}

export interface ISpotlightIndustries {
    id: string;
    industries: {
        code: number;
        caption: string;
    }[];
}