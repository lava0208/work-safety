import type { NextApiRequest, NextApiResponse } from 'next'
import Cookies from 'cookies';

/**
 * Logout
 * @param req 
 * @param res 
 * @returns 
 */
export default function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method == 'POST') {
        const cookies = new Cookies(req, res);
        const token = cookies.get('wsi-auth');
        if (token) {
            cookies.set('wsi-auth', null);
            res.status(204).end();
            return;
        }
    }

    res.status(400).end();
}