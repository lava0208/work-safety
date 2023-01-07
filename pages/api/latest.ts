import { OperationInput } from '@azure/cosmos';
import type { NextApiRequest, NextApiResponse } from 'next'
import { getCompaniesContainer } from '../../utils/db-server';
import { ICompany, Query } from '../../utils/wsi';
import { isAdmin } from './login';

/**
 * If ICompany.isLatest ever gets way out of wack, this endpoint will run through all companies and set it properly.
 * This operation will take time and RUs, so it's not free and shouldn't be overused.
 * @param req POST (empty)
 * @param res 
 * @returns 
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
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
    const placeNamesQuery = new Query<ICompany>()
    .select('place')
    .distinct(true)
    .value(true);

    let totalProcessed = 0;

    const feed = getCompaniesContainer().items.query<string>(placeNamesQuery.toSql(), { maxItemCount: 80 });

    while (true) {
        const placeNames = await feed.fetchNext().then(r => r.resources);
        if (!placeNames || placeNames.length == 0) {
            break;
        }

        while (placeNames.length > 0) {
            const curNames = placeNames.splice(0, 40);
            
            const placeQuery = new Query<ICompany>();
            placeQuery.select(['id', 'place', 'year_filing_for', 'isLatest'])
            .where(curNames.map(n => `r.place = ${placeQuery.addParam(n)}`).join(' OR '))
            .orderBy('year_filing_for');
            
            const curPlaces = await getCompaniesContainer().items.query<ICompany>(placeQuery.toSql()).fetchAll().then(r => r.resources);
            const patchOps: OperationInput[] = [];
            for (const place of curPlaces) {
                patchOps.push({
                    operationType: 'Patch',
                    id: place.id,
                    partitionKey: place.id,
                    resourceBody: {
                        operations: [{
                            op: 'set',
                            path: '/isLatest',
                            value: !curPlaces.some(p => p.place == place.place && p.year_filing_for > place.year_filing_for),
                        }]
                    }
                });
            }

            while (patchOps.length > 0) {
                const uploadBatch = patchOps.splice(0, Math.min(100, patchOps.length));
                const results = await getCompaniesContainer().items.bulk(uploadBatch, { continueOnError: true });
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
        }
    }
}