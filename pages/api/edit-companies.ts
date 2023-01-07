import type { NextApiRequest, NextApiResponse } from 'next'
import { OperationInput } from '@azure/cosmos';
import { flattenBusinesses, generateCharCount, getRevalidateUrls, ICompany, ILocation, Payloads, Query, tokenizeBiz } from '../../utils/wsi';
import { getCompaniesContainer, getLocationsContainer } from '../../utils/db-server';
import { beginJsonImport } from './finish-import';
import { isAdmin } from './login';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (!(await isAdmin(req, res))) {
        return res.status(403).end();
    }

    if (req.method == 'POST') {
        const json = JSON.parse(req.body) as Payloads.IEditCompanies;

        const revalidateProms: Promise<any>[] = [];
        const editProms: Promise<any>[] = [];
        const companyOps: OperationInput[] = [];

        for (const company of json.companies) {
            company.tokenized = tokenizeBiz(company);
            company.charCount = generateCharCount(company.company_name);

            companyOps.push({
                operationType: 'Replace',
                id: company.id,
                partitionKey: company.id,
                resourceBody: company as any,
            });

            for (let url of getRevalidateUrls(company)) {
                revalidateProms.push(res.revalidate(url));
            }
        }

        if (json.merge?.length) {
            const pastCompanyQuery = new Query<ICompany>(['id', 'place']);
            pastCompanyQuery.where(json.merge.map(c => `r.place = ${pastCompanyQuery.addParam(c.place)}`).join(' OR '));
            const pastVersions = await getCompaniesContainer().items.query<Pick<ICompany, 'id' | 'place'>>(pastCompanyQuery.toSql()).fetchAll().then(r => r.resources);

            for (const ver of pastVersions) {
                companyOps.push({
                    operationType: 'Delete',
                    id: ver.id,
                    partitionKey: ver.id,
                });
            }

            const locQuery = new Query<ILocation>();
            locQuery.where(json.merge.map(c => `r.place = ${locQuery.addParam(c.place)}`).join(' OR '));
            const locs = await getLocationsContainer().items.query<ILocation>(locQuery.toSql()).fetchAll().then(r => r.resources);
            for (const loc of locs) {
                loc.place = json.companies[0].place;
                loc.company_name = json.companies[0].company_name;
                if (json.companies[0].ein) {
                    loc.ein = json.companies[0].ein;
                }

                for (let url of getRevalidateUrls(loc)) {
                    revalidateProms.push(res.revalidate(url)); //This will also cover merged companies
                }
            }

            editProms.push(beginJsonImport(flattenBusinesses(locs), { preservePlaceName: true }));
        }

        editProms.push(getCompaniesContainer().items.bulk(companyOps));

        await Promise.all(editProms);
        await Promise.all(revalidateProms); //Must happen after all edits are done

        return res.status(204).end();
    }

    res.status(400).end();
}