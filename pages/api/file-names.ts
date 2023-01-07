import type { NextApiRequest, NextApiResponse } from 'next'
import { getFileBlobNames } from '../../utils/db-server';
import { isAdmin } from './login';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (!(await isAdmin(req, res))) {
        return res.status(403).end();
    }

    if (req.method == 'GET') {
        const filenames = await getFileBlobNames({
            prefix: req.query.prefix as string || ''
        });
        res.status(200).json(filenames);
    }
}