import type { NextApiRequest, NextApiResponse } from 'next'
import { Readable } from 'stream';
import { json2csvAsync } from 'json-2-csv';
import { getDownloadsBlobContainer, getUploadsBlobContainer, getLocations } from '../../utils/db-server';
import { flattenBusinesses, IBiz_Flattened, OSHA_FIELDS, Payloads } from '../../utils/wsi';
import { isAdmin } from './login';

const highWaterMark = 1024 * 1024 * 8; //8MB

/**
 * Get locations of a given company
 * @param req POST. Body: JSON.stringify(getLocationForCompany: ops)
 * @param res ILocation[]
 * @returns 
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method == 'POST') {
        if (!(await isAdmin(req, res))) {
            return res.status(403).end();
        }

        const payload = JSON.parse(req.body) as Payloads.IDownloadRequest;
        let download: IBiz_Flattened[] = [];

        if (payload.companies?.length) {

        }

        if (payload.locations?.length) {
            download = download.concat(flattenBusinesses(await getLocations({ ids: payload.locations })));
        }

        try {
            const csv = await json2csvAsync(download, { keys: OSHA_FIELDS })

            const filename = `osha-${new Date().toISOString()}.csv`;

            await getDownloadsBlobContainer().getBlockBlobClient(filename).uploadStream(Readable.from(csv, { highWaterMark }), highWaterMark, undefined, {
                blobHTTPHeaders: {
                    blobContentType: 'text/csv',
                },
                tier: 'Cool', //Optimize for infrequent access
            });

            return res.status(200).json({
                filename: `https://wsitest.blob.core.windows.net/downloads/${filename}`,
            });
        } catch(ex) {
            console.log('Error downloading companies/locations', ex);
            return res.status(500).end();
        }
    }
    
    return res.status(400).end();
}