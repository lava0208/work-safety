/*
Client-side functions that wrap their server-side counterparts.
I.e., this search() has the same parameters and return type as the one called direclty on the server.
*/

import { DBTypes, getNAICSInfo, ICompany, ILocation, IWsiScoreWeights, Payloads } from "./wsi";

export const search: DBTypes.Search = async (ops) => {
    return postJson<DBTypes.ISearchResult>(`/api/search`, ops);
};

export const getLocations: DBTypes.GetLocations = async (ops) => {
    return postJson<ILocation[]>(`/api/locations`, ops);
};

export const getCompanies: DBTypes.GetCompanies = async (ops) => {
    return postJson<ICompany[]>(`/api/companies`, ops);
};

export function uploadForm<T>(f: FormData): Promise<T> {
    return postJson<T>(`/api/upload`, f, true);
}

export function verifyImport(p: Payloads.IVerifyImport): Promise<Payloads.IFieldMaps> {
    return postJson<Payloads.IFieldMaps>(`/api/verify-import`, p);
}

export function finishImport(p: Payloads.IFinishImport): Promise<Payloads.IFinishImport> {
    return postJson<Payloads.IFinishImport>(`/api/finish-import`, p);
}

export function editCompanies(p: Payloads.IEditCompanies): Promise<any> {
    return postJson<Payloads.IEditCompanies>(`/api/edit-companies`, p);
}

export const getFileNames: DBTypes.GetFileNames = async (ops) => {
    return getJson<string[]>(`/api/file-names?prefix=${ops.prefix}`);
};

export function getNaics(p: Payloads.INAICS): ReturnType<typeof getNAICSInfo> {
    return postJson(`/api/naics`, p);
}

export function saveScoreWeights(p: Payloads.IScoreCalcRequest): Promise<Payloads.IProgressResponse> {
    return postJson<Payloads.IProgressResponse>(`/api/score-calc`, p);
}

export function mergeLocations(p: Payloads.IMergeLocations): Promise<any> {
    return postJson(`/api/merge-locations`, p);
}

export function reportError(p: Payloads.IReportError): Promise<any> {
    return fetch(
        `https://prod-10.centralus.logic.azure.com:443/workflows/c71db9edc00a4602b48495deefb00527/triggers/manual/paths/invoke?api-version=2016-10-01&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=3YeoONhtLaPXSDA15bvQKkx9O7PfOyUqWE--cyM0iEk`,
        {
            method: 'POST',
            body: JSON.stringify(p),
            headers: {
                'Content-Type': 'application/json',
            },
        }
    );
}

export function download(p: Payloads.IDownloadRequest): Promise<Payloads.IDownloadResponse> {
    return postJson(`/api/download`, p);
}

async function getJson<T>(url: string): Promise<T> {
    return new Promise((resolve, reject) => {
        fetch(url)
        .then(response => {
            if (response.status == 204) {
                return;
            } else if (response.ok) {
                return response.json();
            } else {
                reject();
            }
        })
        .then(resolve)
        .catch(reject);
    });
}

export async function postJson<T>(url: string, body: any, skipStringify?: boolean): Promise<T> {
    return new Promise((resolve, reject) => {
        fetch(url, {
            method: 'POST',
            body: skipStringify ? body : JSON.stringify(body),
        })
        .then(response => {
            if (response.status == 204) {
                return;
            } else if (response.ok) {
                return response.json();
            } else {
                reject(response);
            }
        })
        .then(json => {
            resolve(json);
        })
        .catch(reject);
    });
}