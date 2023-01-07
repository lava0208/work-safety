import type { NextApiRequest, NextApiResponse } from 'next'
import { flattenBusinesses, getId, getRevalidateUrls, ILocation, METRICS, METRIC_NAMES, Payloads, Query } from '../../utils/wsi';
import { getLocationsContainer } from '../../utils/db-server';
import { beginJsonImport } from './finish-import';
import { isAdmin } from './login';
import { OperationInput } from '@azure/cosmos';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (!(await isAdmin(req, res))) {
        return res.status(403).end();
    }

    if (req.method == 'POST') {
        const json = JSON.parse(req.body) as Payloads.IMergeLocations;

        const deleteOps: OperationInput[] = [];

        const locQuery = new Query<ILocation>();
        locQuery.where(json.ids.map(id => `r.id = ${locQuery.addParam(id)}`).join(' OR '));
        const locs = await getLocationsContainer().items.query<ILocation>(locQuery.toSql()).fetchAll().then(r => r.resources);

        for (let i = 1; i < locs.length; i++) { //Start at 2nd element
            if (locs[i].year_filing_for == locs[0].year_filing_for) { //Same year, so combine all metrics
                for (const key of METRIC_NAMES) {
                    locs[0][key] += locs[i][key];
                }
                locs[0].annual_average_employees += locs[i].annual_average_employees;
                locs[0].total_hours_worked += locs[i].total_hours_worked;
                locs[0].archive = locs[0].archive || {};
                locs[0].archive.no_injuries_illnesses! += locs[i].archive?.no_injuries_illnesses || 0;
                locs[0].archive.total_other_cases! += locs[i].archive?.total_other_cases || 0;
            } else { //Different year, so force meta fields to match but keep metrics separate
                locs[i].industry = locs[0].industry;
                locs[i].archive = locs[i].archive || {};
                locs[i].archive!.establishment_id = locs[0].archive?.establishment_id;
                locs[i].ein = locs[0].ein;
                locs[i].establishment_name = locs[0].establishment_name;
                locs[i].street_address = locs[0].street_address;
                locs[i].city = locs[0].city;
                locs[i].state = locs[0].state;
                locs[i].zip_code = locs[0].zip_code;
            }

            deleteOps.push({
                operationType: 'Delete',
                id: getId(locs[i]),
                partitionKey: getId(locs[i]),
            });
        }

        const flattened = flattenBusinesses(locs);

        await Promise.all([
            beginJsonImport(flattened, { checkInputLocsForLatest: true }),
            getLocationsContainer().items.bulk(deleteOps)
        ]);

        const revalidateProms: Promise<any>[] = [];
        for (const loc of locs.slice(1)) {
            for (const url of getRevalidateUrls(loc)) {
                revalidateProms.push(res.revalidate(url));
            }
        }
        await Promise.all(revalidateProms);

        return res.status(204).end();
    }

    res.status(400).end();
}