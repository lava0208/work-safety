import { GetServerSideProps, NextPage } from 'next';
import { Logger, SITEMAP_ENTRIES_PER_FILE } from '../utils/wsi';
import * as DBServer from '../utils/db-server';

export const getServerSideProps: GetServerSideProps = async ({ res }) => {
    const logger = new Logger();
    const base = process.env.ORIGIN;
    const lines: string[] = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ];

    const counts = await Promise.all([
        DBServer.getCompaniesContainer().items.query<number>('SELECT VALUE COUNT(1) FROM r WHERE r.isLatest = true').fetchAll().then(r => r.resources[0]),
        DBServer.getLocationsContainer().items.query<number>('SELECT VALUE COUNT(locs) FROM (SELECT DISTINCT r.locationId FROM r) as locs').fetchAll().then(r => r.resources[0]),
    ]);

    for (let i = 0; i < counts[0]; i += SITEMAP_ENTRIES_PER_FILE) {
        lines.push('<sitemap>');
        lines.push(`<loc>${base}/sitemap/company-${i}.xml</loc>`);
        lines.push('</sitemap>');
    }
    for (let i = 0; i < counts[1]; i += SITEMAP_ENTRIES_PER_FILE) {
        lines.push('<sitemap>');
        lines.push(`<loc>${base}/sitemap/loc-${i}.xml</loc>`);
        lines.push('</sitemap>');
    }

    lines.push('</sitemapindex>');

    res.write(lines.join(''));
    res.end();

    logger.end('Finished generating sitemap index');

    return {
        props: {},
    };
}

const Page: NextPage = () => {
    return <></>; //getServerSideProps() does all the work
}

export default Page;