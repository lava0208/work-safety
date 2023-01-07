import type { NextApiRequest, NextApiResponse } from 'next'
import { search } from '../../utils/db-server';

/**
 * Search for locations
 * @param req POST. Body: JSON.stringify(DBTypes.ISearchProps)
 * @param res DBTypes.SearchResult
 * @returns 
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method == 'POST') {
        const result = await search(JSON.parse(req.body));
        if (result) {
            return res.status(200).json(result);
        } else {
            return res.status(204).end();
        }
    }
 
    return res.status(400).end();
}