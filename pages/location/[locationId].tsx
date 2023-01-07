import Head from 'next/head';
import { GetStaticPaths, GetStaticProps, NextPage } from 'next';
import { useEffect, useRef, useState } from 'react';
import { IncidentsCard } from '../../components/incidents-card';
import { ChartMetric, TrendsCard } from '../../components/trends-card';
import { BizHeader } from '../../components/biz-header';
import { LocationsSidebar } from '../../components/locations-sidebar';
import { Gauges } from '../../components/gauges';
import { IIndustryInfo, ILocation, Metric, ICompany, getNAICSInfo, TOTAL_YEARS, INAICS, YEARS_ARR } from '../../utils/wsi';
import * as DBServer from '../../utils/db-server';
import { YearSelector } from '../../components/year-selector';

export const getStaticPaths: GetStaticPaths = async (context) => {
    /*
    We're returning [] right now so it doesn't generate any pages at build time.
    This is because the build machine would need a static IP in order for us to whitelist it in CosmosDB so it can access the DB and get data.
    For now, we don't want to do that.
    
    We still use getStaticPaths so that it *will* cache pages when they're built on the server at runtime.
    */
    return {
        paths: [],
        fallback: 'blocking',
    };
}

export const getStaticProps: GetStaticProps = async (context) => {
    if (!context.params?.locationId) {
        return {
            notFound: true,
        };
    }

    const locations: ILocation[] = [];
    const industryInfos: IIndustryInfo[] = [];
    const companies: ICompany[] = [];
    const naics: INAICS[string][] = [];

    return await DBServer.getLocations({ locationId: context.params?.locationId as ILocation['locationId'], limit: 10, orderBy: 'year_filing_for' })
    .then(locs => {
        if (locs?.length > 0) {
            locations.push.apply(locations, locs);

            let naicsProm;
            const naicsCode = locations.find(c => c.industry)?.industry?.naics_code;
            if (naicsCode) {
                naicsProm = getNAICSInfo(naicsCode, TOTAL_YEARS);
            }
            
            return Promise.all([
                DBServer.getCompanies({ place: locs[0].place }).then(plcs => {
                    if (plcs?.length) {
                        companies.push.apply(companies, plcs);
                    }
                }),
                DBServer.getIndustryInfos({ naicsCode: locations[0].industry?.naics_code }).then(infos => {
                    if (infos?.length > 0) {
                        industryInfos.push.apply(industryInfos, infos as IIndustryInfo[]);
                    }
                }),
                naicsProm?.then(n => {
                    naics.push.apply(naics, n);
                })
            ]);
        }
    })
    .then(() => {
        if (locations?.length > 0) {
            return {
                props: {
                    locations: locations,
                    industryInfos: industryInfos.length ? industryInfos : null,
                    companies: companies.length ? companies : null,
                    naics
                } as IProps,
                revalidate: 60 * 60, //1 hour (in seconds)
            };
        } else {
            return {
                notFound: true,
            };
        }
    });
}

const Page: NextPage<IProps> = (props) => {
    const mainLoc = props.locations[0];
    const mainCompany = props.companies ? props.companies[0] : null;

    const [activeDataIdx, setActiveDataIdx] = useState(0);

    const [chartMetric, setChartMetric] = useState('trir' as ChartMetric);

    const [isFlashingChart, setIsFlashingChart] = useState(false);
    function flashChart(m: Metric) {
        if (m == 'trir' || m == 'dart' || m == 'total_incidents') {
            setChartMetric(m);
            setIsFlashingChart(true);
            window.setTimeout(() => {
                setIsFlashingChart(false);
            }, 500);
        }
    }

    const yearSelector = useRef<HTMLDivElement>();
    useEffect(() => {
        if (!yearSelector.current) {
            return;
        }

        const containerRect = yearSelector.current.getBoundingClientRect();
        const selectedRect = yearSelector.current.querySelector('._primary')!.getBoundingClientRect();

        if (selectedRect.left < containerRect.left) {
            yearSelector.current.scrollTo({
                left: yearSelector.current.scrollLeft - (containerRect.left - selectedRect.left),
                behavior: 'smooth',
            });
        } else if (selectedRect.right > containerRect.right) {
            yearSelector.current.scrollTo({
                left: yearSelector.current.scrollLeft - (containerRect.right - selectedRect.right),
                behavior: 'smooth',
            });
        }
    }, [activeDataIdx]);

    return <>
        <Head>
            <title>{`${mainLoc.establishment_name} -  ${mainLoc.company_name} | Work Safety Index`}</title>
            <meta property="og:title" content={`${mainLoc.company_name} - ${mainLoc.company_name} | Work Safety Index`} />
            <meta
                name="description"
                key="desc"
                content={`View the ${mainLoc.establishment_name} location for ${mainLoc.company_name}. See statistics, injuries, days away from work, and deaths.`}
            />
            <meta
                property="og:description"
                content={`View the ${mainLoc.establishment_name} location for ${mainLoc.company_name}. See statistics, injuries, days away from work, and deaths.`}
            />
        </Head>

        <main className="max-w-screen-xl mx-auto px-4 py-8">
            <BizHeader company={mainCompany} location={mainLoc} />

            <div className="grid grid-cols-1 lg:grid-cols-[5fr,_2fr] lg:gap-4 items-start mt-6">
                <div className='grid grid-cols-1 gap-10'>
                    <div className="flex flex-col gap-4">
                        <YearSelector businesses={props.locations} onChange={setActiveDataIdx} />
                        <Gauges businesses={props.locations} naics={props.naics.filter(n => props.locations.some(c => c.year_filing_for == n.year_filing_for))} viewingIdx={activeDataIdx} />
                        <IncidentsCard metricClickedFcn={flashChart} businesses={props.locations} industryInfos={props.industryInfos} viewingIdx={activeDataIdx} />
                    </div>

                    <TrendsCard metric={chartMetric} setChartMetricFcn={setChartMetric} businesses={props.locations} naics={props.naics} isFlashingChart={isFlashingChart} />
                </div>

                <div>
                    <div className="lg:hidden w-1/2 h-[2px] mx-auto my-4 bg-primary"></div>

                    <h3 className="text-xl font-light">Other locations</h3>
                    <LocationsSidebar relatedTo={mainLoc} />
                </div>
            </div>
        </main>
    </>;
}

interface IProps {
    locations: ILocation[]; //[0] is the newest, [end] is the oldest
    industryInfos?: IIndustryInfo[]; //[0] is the newest, [end] is the oldest
    companies?: ICompany[]; //[0] is the newest, [end] is the oldest
    naics: INAICS[string][];
}

export default Page;