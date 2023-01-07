import type { NextApiRequest, NextApiResponse } from 'next'
import formidable from 'formidable';
import { getUploadsBlobContainer } from '../../utils/db-server';
import { PassThrough } from 'stream';
import { openCSVBlob, generateOshaFieldMaps } from '../../utils/wsi';
import { isAdmin } from './login';

const highWaterMark = 1024 * 1024 * 8; //8MB

/**
 * Upload file to persistent blob storage
 * @param req POST. Body: FormData()
 * @param res Payloads.IVerifyImport
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (!(await isAdmin(req, res))) {
        return res.status(403).end();
    }

    if (req.method == 'POST') {
        const stream = new PassThrough({
            writableHighWaterMark: highWaterMark,
            readableHighWaterMark: highWaterMark,
        });
        const form = new formidable.IncomingForm({
            fileWriteStreamHandler: () => {
                return stream;
            },
        });

        await new Promise((resolve, reject) => {
            form.on('fileBegin', async (e, file) => {
                const mimeType = file.mimetype || 'text/csv';
                const newFileName = `osha-${new Date().toISOString().slice(0, 10)}-${file.originalFilename}`;
                
                try {
                    await getUploadsBlobContainer().getBlockBlobClient(newFileName).uploadStream(stream, highWaterMark, undefined, {
                        blobHTTPHeaders: {
                            blobContentType: mimeType,
                        },
                        tier: 'Cool', //Optimize for infrequent access
                    });
                } catch (ex) {
                    console.error('Error streaming file upload to blob storage', newFileName, ex);
                    return reject();
                }
    
                try {
                    return resolve({
                        filename: newFileName,
                        ...await generateOshaFieldMaps(await openCSVBlob(newFileName))
                    });
                } catch (ex) {
                    console.error('Error parsing/saving OSHA data', newFileName, ex);
                    return reject();
                }
            });

            try {
                form.parse(req, async (err, fields, files) => {
                    if (err) {
                        console.error('Error parsing file upload', err);
                        return reject();
                    }
                    
                    if (!files || Array.isArray(files) && files.length == 0) {
                        reject('No files found in request body');
                    }
                });
            } catch (ex) {
                console.error('Error uploading file', ex);
            }
        })
        .then(result => {
            return res.status(200).json(result);
        })
        .catch(ex => {
            return res.status(500).end();
        });
    }
}

export const config = {
    api: {
        bodyParser: false, //Disable NextJS body parsing so formidable can do that itself (fails silently otherwise)
    },
};