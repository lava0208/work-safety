import type { NextApiRequest, NextApiResponse } from 'next'
import { getNAICSInfo, Payloads } from '../../utils/wsi';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method == 'POST') {
        const json = JSON.parse(req.body) as Payloads.INAICS;
        if (!json || json.code == null) {
            return res.status(400).end();
        }

        return res.status(200).json(await getNAICSInfo(json.code, json.numYears));
    }

    res.status(400).end();
}