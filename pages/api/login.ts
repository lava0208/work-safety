import type { NextApiRequest, NextApiResponse } from 'next'
import Cookies from 'cookies';
import Iron from '@hapi/iron';
import { getStaticRecord } from '../../utils/db-server';
import { NextApiRequestCookies } from 'next/dist/server/api-utils';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method == 'POST') {
        const json = JSON.parse(req.body);
        const adminHash = (await getStaticRecord<IPassRecord>('admin_user'))?.hash;

        if (json.pass && adminHash && (await Iron.unseal(adminHash, process.env.HAPI_PASSWORD!, Iron.defaults)) == json.pass) {
            const cookies = new Cookies(req, res);
            cookies.set('wsi-auth', adminHash);
            
            res.status(204).end();
            return;
        }
    } else if (req.method == 'GET') {
        if (await isAdmin(req, res)) {
            res.status(204).end();
        } else {
            res.status(403).end();
        }
    }

    res.status(400).end();
}

export async function isAdmin(req?: NextApiRequest, res?: NextApiResponse, cookies?: NextApiRequestCookies): Promise<boolean> {
    let thisHash: string | undefined = '';
    
    if (req && res) {
        thisHash = new Cookies(req, res).get('wsi-auth');
    } else if (cookies) {
        thisHash = cookies['wsi-auth'];
    }

    const adminHash = (await getStaticRecord<IPassRecord>('admin_user'))?.hash;

    if (thisHash && adminHash && thisHash == adminHash) {
        return true;
    } else {
        return false;
    }
}

interface IPassRecord {
    id: string;
    hash: string;
}