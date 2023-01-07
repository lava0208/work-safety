import { OperationInput } from '@azure/cosmos';
import type { NextApiRequest, NextApiResponse } from 'next'
import { getCompaniesContainer, getLocationsContainer } from '../../utils/db-server';
import { generateCharCount, ILocation, Logger, Query, tokenizeBiz, tokenizeString } from '../../utils/wsi';
import { isAdmin } from './login';

/**
 * I often needed to iterate over all records to update things that hadn't been handled correctly in import.
 * This is just a general loop funciton that can be customized for any operation.
 * Feel free to re-write this function to suit your needs in the moment.
 * 
 * This operation will take time and RUs, so it's not free and shouldn't be overused.
 * @param req POST (empty)
 * @param res 
 * @returns 
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    /*
    If you call this method from Postman or CURL, first comment this isAdmin() check out since auth will be missing.
    Then add it back in so no unauthorized users can run this function.
    */
    if (!(await isAdmin(req, res))) {
        return res.status(403).end();
    }

    if (req.method == 'POST') {
        run();
        return res.status(204).end();
    }
    
    return res.status(400).end();
}

async function run() {
    const logger = new Logger();

    const totalCount = await getLocationsContainer().items.query<number>(`SELECT VALUE COUNT(LOCS) FROM (SELECT DISTINCT r.locationId FROM r) as LOCS`).fetchAll().then(r => r.resources[0]);
    let totalProcessed = 0;
    logger.log(`Running ${totalCount} updates`);

    const locIdFeed = getLocationsContainer().items.query<ILocation>(`SELECT DISTINCT VALUE r.locationId FROM r`, { maxItemCount: 6 });
    while (true) {
        const locIds = await locIdFeed.fetchNext().then(r => r.resources);
        if (!locIds || locIds.length == 0) {
            break;
        }

        const loadProms: Promise<Pick<ILocation, 'id' | 'locationId' | 'year_filing_for'>[]>[] = [];
        for (const id of locIds) {
            loadProms.push(getLocationsContainer().items.query<Pick<ILocation, 'id' | 'locationId' | 'year_filing_for'>>(`SELECT r.id, r.locationId, r.year_filing_for FROM r WHERE r.locationId = '${id}'`).fetchAll().then(r => r.resources));
        }
        const results = await Promise.all(loadProms);

        const patchOps: OperationInput[] = [];
        for (const result of results) {
            for (const loc of result) {
                patchOps.push({
                    operationType: 'Patch',
                    id: loc.id,
                    partitionKey: loc.id,
                    resourceBody: {
                        operations: [
                            {
                                op: 'set',
                                path: '/isLatest',
                                value: !result.some(l => l.year_filing_for > loc.year_filing_for),
                            },
                        ]
                    }
                });
            }
        }

        while (patchOps.length > 0) {
            const uploadBatch = patchOps.splice(0, Math.min(100, patchOps.length));
            const results = await getLocationsContainer().items.bulk(uploadBatch, { continueOnError: true });
            for (let i = 0; i < results.length; i++) {
                if (results[i].statusCode == 429) {
                    console.log('retry');
                    patchOps.push(uploadBatch[i]);
                } else {
                    totalProcessed++;
                }
            }

            if (patchOps.length > 0) {
                console.log('wait');
                await new Promise(res => {
                    setTimeout(res, 100);
                });
            }
        }

        logger.log(`Finished ${totalProcessed} updates (${Math.floor(totalProcessed / totalCount * 100)}%)`);
    }

    logger.end('Done!');
}