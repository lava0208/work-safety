import type { NextApiRequest, NextApiResponse } from 'next'
import { OperationInput } from '@azure/cosmos';
import { setStaticRecord, getCompaniesContainer } from '../../utils/db-server';
import { wsiScoreWeights, Query, ICompany, Logger, calcWsiScore, Payloads, UUID, delimitNum } from '../../utils/wsi';
import { isAdmin } from './login';

const inProgress: { [id: string]: Payloads.IProgressResponse } = {};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (!(await isAdmin(req, res))) {
        return res.status(403).end();
    }

    if (req.method == 'POST') {
        const json = JSON.parse(req.body) as Payloads.IScoreCalcRequest;

        if (json.nonce) {
            if (inProgress[json.nonce]) {
                return res.status(200).json(inProgress[json.nonce]);
            }
        } else {
            console.log('Recalculating all scores');

            const task: Payloads.IProgressResponse = {
                nonce: UUID(),
                completed: 0,
                total: (await getCompaniesContainer().items.query<number>(`SELECT VALUE COUNT(1) FROM r WHERE r.isLatest = true`).fetchAll().then(r => r.resources))[0],
            };
            inProgress[task.nonce] = task;
            
            await setStaticRecord('wsi_score_weights', json.weights);
            wsiScoreWeights.clear();
            updateAllScores(task.nonce);
    
            return res.status(200).json(task);
        }
    }

    res.status(400).end();
}

async function updateAllScores(nonce: Payloads.IProgressResponse['nonce']) {
    const logger = new Logger();
    const query = new Query<ICompany>()
    .where(`r.isLatest = true`);

    const feed = getCompaniesContainer().items.query<ICompany>(query.toSql(), { maxItemCount: 95 });

    while (true) {
        const companies = await feed.fetchNext().then(r => r.resources);
        if (!companies || companies.length == 0) {
            break;
        }

        const proms: Promise<any>[] = [];
        
        for (const comp of companies) {
            proms.push(calcWsiScore(comp));
        }
        
        const patchOps: OperationInput[] = [];
        await Promise.all(proms).then(scores => {
            for (let i = 0; i < scores.length; i++) {
                patchOps.push({
                    operationType: 'Patch',
                    id: companies[i].id,
                    partitionKey: companies[i].id,
                    resourceBody: {
                        operations: [{
                            op: 'set',
                            path: '/wsi_score',
                            value: scores[i],
                        }],
                    },
                });
            }
        });

        while (patchOps.length > 0) {
            const uploadBatch = patchOps.splice(0);
            const results = await getCompaniesContainer().items.bulk(uploadBatch, { continueOnError: true });
            for (let i = 0; i < results.length; i++) {
                if (results[i].statusCode == 429) {
                    console.log('retry');
                    patchOps.push(uploadBatch[i]);
                } else {
                    inProgress[nonce].completed++;
                }
            }

            if (patchOps.length > 0) {
                console.log('wait');
                await new Promise(res => {
                    setTimeout(res, 100);
                });
            }
        }

        logger.log(`Re-scored ${delimitNum(inProgress[nonce].completed)} companies (${Math.floor(inProgress[nonce].completed / inProgress[nonce].total * 100)}%)`);
    }

    //Clean up
    logger.end('Done!');
    await new Promise(res => {
        setTimeout(res, 10000);
    });
    delete inProgress[nonce];
}