import { useState, useEffect } from 'react';
import { GetStaticPaths, GetStaticProps, NextPage } from 'next';
import Head from 'next/head';
import { NavLink } from '../../components/nav-link';
import { SplitCard } from '../../components/split-card';
import { Score } from '../../components/score';
import { AddCircle, RemoveCircle, Star, InformationCircleOutline } from 'react-ionicons';
import { CompanyCard } from '../../components/company-card';
import { IncidentsCard } from '../../components/incidents-card';
import { ChartMetric, TrendsCard } from '../../components/trends-card';
import { humanizeScoreFactor, IIndustryInfo, ICompany, Metric, INAICS, getNAICSInfo, TOTAL_YEARS, humanizeScore, YEARS_ARR } from '../../utils/wsi';
import { BizHeader } from '../../components/biz-header';
import { LocationsSidebar } from '../../components/locations-sidebar';
import * as DBServer from '../../utils/db-server';
import * as DBClient from '../../utils/db-client';
import { Gauges } from '../../components/gauges';
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
    if (!context.params?.place) {
        return {
            notFound: true,
        };
    }

    return DBServer.getCompanies({ place: context.params?.place as string }).then(companies => {
        if (companies?.length > 0) {
            DBServer.incrementPopularity(companies[0]);

            let naicsProm;
            const naicsCode = companies.find(c => c.industry)?.industry?.naics_code;
            if (naicsCode) {
                naicsProm = getNAICSInfo(naicsCode, TOTAL_YEARS);
            }

            return Promise.all([
                naicsProm,
                DBServer.getIndustryInfos({ naicsCode: companies[0].industry?.naics_code }),
            ]).then(results => {
                if (results[1].length > 0) {
                    return {
                        props: {
                            companies: companies,
                            industryInfos: results[1],
                            naics: results[0],
                        } as IProps,
                        revalidate: 60 * 60, //1 hour (in seconds)
                    };
                } else {
                    return {
                        props: {
                            companies: companies,
                            naics: results[0],
                        } as IProps,
                        revalidate: 60 * 60, //1 hour (in seconds)
                    };
                }
            });
        } else {
            return {
                notFound: true,
            };
        }
    });
}

const Page: NextPage<IProps> = (props) => {
    const mainCompany = props.companies[0];

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

    const [relatedCompanies, setRelatedCompanies] = useState(null as ICompany[] | null);
    useEffect(() => {
        DBClient.getCompanies({ relatedTo: mainCompany, limit: 4, })
            .then(setRelatedCompanies)
            .catch(setRelatedCompanies.bind(null, []));
    }, [mainCompany]);

    useEffect(() => {
        setRelatedCompanies(null);
    }, [mainCompany]);

    return <>
        <Head>
            <title>{`${mainCompany.company_name} | Work Safety Index`}</title>
            <meta property="og:title" content={`${mainCompany.company_name} | Work Safety Index`} />
            <meta
                name="description"
                key="desc"
                content={`${mainCompany.company_name} ${mainCompany.annual_average_employees} employees ${mainCompany.num_locations} locations. Safety statistics, injuries, days away from work, and deaths.`}
            />
            <meta
                property="og:description"
                content={`${mainCompany.company_name} ${mainCompany.annual_average_employees} employees ${mainCompany.num_locations} locations. Safety statistics, injuries, days away from work, and deaths.`}
            />
        </Head>

        <main className="max-w-screen-xl mx-auto px-4 py-8">
            <BizHeader company={mainCompany} tab='summary' />

            <div className="grid grid-cols-1 lg:grid-cols-[5fr,_2fr] lg:gap-4 items-start mt-6">
                <div className='grid grid-cols-1 gap-10'>
                    {(mainCompany.wsi_score != null || mainCompany.num_reviews > 0) && (
                        <SplitCard>
                            <SplitCard.Header>
                                <div className={`${mainCompany.wsi_score != null && mainCompany.num_reviews > 0 ? 'grid-cols-2' : 'grid-cols-1'} relative grid gap-14 px-2 py-10 md:py-7`}>
                                    {/* <button className="absolute top-1 right-1 flex items-center px-2 py-0.5 text-sm bg-transparent text-zinc-400 fill-zinc-400 hover:text-zinc-900 hover:fill-zinc-900 transition">
                                        <InformationCircleOutline color='' width='1.1rem' height='1.1rem' cssClasses={'text-inherit fill-inherit'} />
                                        <span className='ml-0.5'>
                                            How is this calculated?
                                        </span>
                                    </button> */}
                                    {mainCompany.wsi_score != null && (
                                        <div className={`${mainCompany.num_reviews > 0 ? 'justify-self-end' : ''} flex flex-col justify-between items-center`}>
                                            <Score score={mainCompany.wsi_score.score} size={4.4} />
                                            <div className="flex items-center h-10 mt-2">
                                                <h3 className='text-lg leading-none text-center'>SafetyScore</h3>
                                            </div>
                                        </div>
                                    )}
                                    {mainCompany.num_reviews > 0 && (
                                        <div className={`${mainCompany.wsi_score != null ? 'justify-self-start' : ''} flex flex-col justify-between items-center`}>
                                            <div className="relative flex justify-center items-center w-[4.25rem] h-[4.25rem] bg-primary rounded-full overflow-hidden">
                                                <Star color='' width='4rem' height='4rem' cssClasses='mt-[-3px] text-white fill-white opacity-[0.175]' />
                                                <span className="absolute text-white text-3xl font-semibold rounded-full">{mainCompany.average_review}</span>
                                            </div>
                                            <div className="flex items-center h-10 mt-2">
                                                <h3 className='w-24 text-lg leading-none text-center'>Community rating</h3>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </SplitCard.Header>
                            <SplitCard.Body>
                                <div className="p-2">
                                    <div className="w-3/4 mx-auto mt-3 px-4 py-3 text-center bg-white rounded-lg">
                                        <h3 className="text-lg">
                                            {humanizeScore(mainCompany.wsi_score?.score)}
                                        </h3>
                                    </div>
                                    <div
                                        className={`${mainCompany.wsi_score?.positives?.length && mainCompany.wsi_score.negatives?.length ? 'md:grid-cols-2' : 'grid-cols-1'} grid justify-items-center items-center gap-4 md:w-3/4 mx-auto mt-6 mb-5`}
                                    >
                                        {mainCompany.wsi_score?.positives && mainCompany.wsi_score.positives.length > 0 && (
                                            <div className='flex md:block flex-col items-start'>
                                                {mainCompany.wsi_score?.positives.map(p => {
                                                    return (
                                                        <div
                                                            key={p.key}
                                                            className="flex items-center mt-2"
                                                        >
                                                            <AddCircle color='' width='1.5rem' height='1.5rem' cssClasses='text-green-700 fill-green-700' />
                                                            <div className="ml-2 text-lg leading-tight">{humanizeScoreFactor(p)}</div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                        {mainCompany.wsi_score?.negatives && mainCompany.wsi_score.negatives.length > 0 && (
                                            <div className='flex md:block flex-col items-start'>
                                                {mainCompany.wsi_score?.negatives.map(p => {
                                                    return (
                                                        <div
                                                            key={p.key}
                                                            className="flex items-center mt-2"
                                                        >
                                                            <RemoveCircle color='' width='1.55rem' height='1.55rem' cssClasses='text-red-700 fill-red-700' />
                                                            <div className="ml-2 text-lg leading-tight">{humanizeScoreFactor(p)}</div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </SplitCard.Body>
                        </SplitCard>
                    )}

                    {/* <div>
                        <h1 className="text-2xl font-light">Safety statement</h1>
                        <div className="flex flex-col justify-center items-center h-36 p-4 bg-zinc-100 rounded-lg">
                            <p className='text-lg italic text-zinc-500'>This company hasn't submitted a safety statement yet.</p>
                            <div className="mt-4">
                                <button className='bg-zinc-200'>Add one</button>
                            </div>
                        </div>
                    </div> */}

                    <div className="flex flex-col gap-4">
                        <YearSelector businesses={props.companies} onChange={setActiveDataIdx} />
                        <Gauges businesses={props.companies} naics={props.naics.filter(n => props.companies.some(c => c.year_filing_for == n.year_filing_for))} viewingIdx={activeDataIdx} />
                        <IncidentsCard metricClickedFcn={flashChart} businesses={props.companies} industryInfos={props.industryInfos} viewingIdx={activeDataIdx} />
                    </div>

                    <TrendsCard metric={chartMetric} setChartMetricFcn={setChartMetric} businesses={props.companies} naics={props.naics} isFlashingChart={isFlashingChart} />
                </div>

                <div className='mt-10 lg:mt-0'>
                    <NavLink href={`/locations/${mainCompany.place}`}>
                        <h3 className="text-xl font-light cursor-pointer">Locations</h3>
                    </NavLink>
                    <LocationsSidebar relatedTo={mainCompany} />

                    <h3 className="mt-10 lg:mt-4 text-xl font-light">Related</h3>
                    <div className={`${relatedCompanies == null ? 'animate-pulse' : ''}`}>
                        {relatedCompanies && (<>
                            <div className="p-2 bg-zinc-100 rounded-lg">
                                {relatedCompanies.map(l => (
                                    <CompanyCard
                                        key={l.id}
                                        company={l}
                                        spacing='tight'
                                        hideIndustry
                                    />
                                ))}
                                {relatedCompanies.length == 0 && (
                                    <div className="p-2 text-zinc-400">
                                        We didn't find any related businesses
                                    </div>
                                )}
                            </div>
                        </>) || (<>
                            <div className="flex my-2 p-2 bg-zinc-100 rounded-lg">
                                <div className="w-14 h-14 bg-zinc-200/50"></div>
                                <div className='grow ml-2'>
                                    <div className="w-1/2 h-6 bg-zinc-200/50"></div>
                                    <div className="w-1/3 h-2 mt-2 bg-zinc-200/50"></div>
                                </div>
                            </div>
                            <div className="flex my-2 p-2 bg-zinc-100 rounded-lg">
                                <div className="w-14 h-14 bg-zinc-200/50"></div>
                                <div className='grow ml-2'>
                                    <div className="w-1/2 h-6 bg-zinc-200/50"></div>
                                    <div className="w-1/3 h-2 mt-2 bg-zinc-200/50"></div>
                                </div>
                            </div>
                        </>)}
                    </div>
                </div>
            </div>
        </main>
    </>;
}

interface IProps {
    companies: ICompany[]; //[0] is the newest, [end] is the oldest
    industryInfos?: IIndustryInfo[]; //[0] is the newest, [end] is the oldest
    naics: INAICS[string][];
}

export default Page;