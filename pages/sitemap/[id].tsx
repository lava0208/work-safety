import { GetServerSideProps, NextPage } from 'next';
import { Logger, Query, ICompany, ILocation, SITEMAP_ENTRIES_PER_FILE } from '../../utils/wsi';
import * as DBServer from '../../utils/db-server';

export const getServerSideProps: GetServerSideProps = async (context) => {
    const id = context.params?.id as string;
    if (!id) {
        return {
            notFound: true,
        };
    }

    const type: 'company' | 'loc' = id.includes('company') ? 'company' : 'loc';
    const offset = parseInt(id.substring(id.indexOf('-') + 1));

    if (isNaN(offset) || offset < 0) {
        return {
            notFound: true,
        };
    }

    const logger = new Logger();
    const base = process.env.ORIGIN;
    const lines: string[] = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ];

    await new Promise<void>(async (resolve, reject) => {
        if (type == 'company') {
            const query = new Query<ICompany>()
            .select('place')
            .where(`r.isLatest = true`)
            .offset(offset).limit(SITEMAP_ENTRIES_PER_FILE);
    
            let numCompanies = 0;
            const feed = DBServer.getCompaniesContainer().items.query<Pick<ICompany, 'place'>>(query.toSql(), { maxItemCount: 400 });
    
            while (true) {
                const companies = await feed.fetchNext().then(r => r.resources);
                if (!companies || companies.length == 0) {
                    break;
                }
    
                for (const comp of companies) {
                    lines.push(`<url><loc>${base}/summary/${comp.place}</loc></url>`);
                }
    
                numCompanies += companies.length;
                logger.log(`Added ${numCompanies} companies to the sitemap`);

                if (numCompanies >= SITEMAP_ENTRIES_PER_FILE) {
                    break;
                }
            }
        } else {
            const query = new Query<ILocation>()
            .select('locationId')
            .distinct(true)
            .offset(offset).limit(SITEMAP_ENTRIES_PER_FILE);
    
            let numLocs = 0;
            const feed = DBServer.getLocationsContainer().items.query<Pick<ILocation, 'locationId'>>(query.toSql(), { maxItemCount: 400 });
    
            while (true) {
                const locs = await feed.fetchNext().then(r => r.resources);
                if (!locs || locs.length == 0) {
                    break;
                }
    
                for (const loc of locs) {
                    lines.push(`<url><loc>${base}/location/${loc.locationId}</loc></url>`);
                }
    
                numLocs += locs.length;
                logger.log(`Added ${numLocs} locations to the sitemap`);

                if (numLocs >= SITEMAP_ENTRIES_PER_FILE) {
                    break;
                }
            }
        }

        resolve();
    });

    lines.push('</urlset>');
    
    context.res.write(lines.join(''));
    context.res.end();

    logger.end('Finished generating sitemap');

    return {
        props: {},
    };
}

const Page: NextPage = () => {
    return <></>; //getServerSideProps() does all the work
}

export default Page;