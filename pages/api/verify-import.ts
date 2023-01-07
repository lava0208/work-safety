import type { NextApiRequest, NextApiResponse } from 'next'
import { openCSVBlob, generateOshaFieldMaps, Payloads } from '../../utils/wsi';
import { isAdmin } from './login';

/**
 * Upload file to persistent blob storage
 * @param req POST. Body: Payloads.IVerifyImport
 * @param res Payloads.IFieldMaps
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (!(await isAdmin(req, res))) {
        return res.status(403).end();
    }

    if (req.method == 'POST') {
        const payload = JSON.parse(req.body) as Payloads.IVerifyImport;

        try {
            const fieldMaps = await generateOshaFieldMaps(await openCSVBlob(payload.filename));
            return res.status(200).json({
                filename: payload.filename,
                ...fieldMaps,
            });
        } catch (ex) {
            console.error(`Error verifying import for filename '${payload.filename}'`, ex);
            return res.status(500).end();
        }
    }
}