import type { NextApiRequest, NextApiResponse } from 'next'
import { getCompanies } from '../../utils/db-server';

/**
 * Get companies related to a given company
 * @param req POST. Body: JSON.stringify(getRelatedCompanies: ops)
 * @param res ILocation[]
 * @returns 
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method == 'POST') {
        const result = await getCompanies(JSON.parse(req.body));
        if (result) {
            return res.status(200).json(result);
        } else {
            return res.status(204).end();
        }
    }
    
    return res.status(400).end();
}