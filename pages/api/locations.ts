import type { NextApiRequest, NextApiResponse } from 'next'
import { getLocations } from '../../utils/db-server';

/**
 * Get locations of a given company
 * @param req POST. Body: JSON.stringify(getLocationForCompanies: ops)
 * @param res ILocation[]
 * @returns 
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method == 'POST') {
        const result = await getLocations(JSON.parse(req.body));
        if (result) {
            return res.status(200).json(result);
        } else {
            return res.status(204).end();
        }
    }
    
    return res.status(400).end();
}