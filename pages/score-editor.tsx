import { GetServerSideProps, NextPage } from 'next';
import Head from 'next/head';
import * as DBClient from '../utils/db-client';
import { calcWsiScore, wsiScoreWeights, humanizeScoreMetric, ICompany, INAICS, IWsiScoreWeights, Payloads, IWsiScore, humanizeScoreFactor } from '../utils/wsi';
import { useEffect, useState } from 'react';
import { SearchBar } from '../components/search-bar';
import { CompanyCard } from '../components/company-card';
import { Close } from 'react-ionicons';
import { Loader } from '../components/loader';
import { isAdmin } from './api/login';

export const getServerSideProps: GetServerSideProps = async (context) => {
    if (!(await isAdmin(undefined, undefined, context.req.cookies))) {
        return {
            redirect: {
                destination: '/login',
                permanent: false,
            }
        };
    }

    return {
        props: {
            weights: await wsiScoreWeights.get(),
        } as IProps,
    };
}

const FACTORS: (keyof IWsiScoreWeights)[] = [
    "trir",
    "trir_forecast",
    "trir_diff_avg",
    "dart",
    "dart_diff_avg",
    "avg_death_rate",
    "user_reviews",
];

const Page: NextPage<IProps> = (props) => {
    const [weights, setWeights] = useState(props.weights as any as Record<keyof IWsiScoreWeights, string>);

    function getNumWeights(): IWsiScoreWeights {
        const numWeights = {} as IWsiScoreWeights;
        for (const key in weights) {
            const float = parseFloat(weights[key as keyof IWsiScoreWeights]);
            if (float != null && !isNaN(float)) {
                numWeights[key as keyof IWsiScoreWeights] = float;
            } else {
                numWeights[key as keyof IWsiScoreWeights] = weights[key as keyof IWsiScoreWeights] as any;
            }
        }
        return numWeights;
    }

    function coerceFloat(s: string): number {
        const f = parseFloat(s);
        return isNaN(f) ? 0.0 : f;
    }

    const [companyInfos, setCompanyInfos] = useState([] as ICompanyInfos[]);

    const [isLoadingCompany, setIsLoadingCompany] = useState(false);
    async function loadCompany(place: ICompany['place']) {
        if (companyInfos.some(i => i.company.place == place)) {
            return;
        }

        setIsLoadingCompany(true);

        try {
            const newCompany = (await DBClient.getCompanies({ place, limit: 1, }))[0];
            const newNaics = await DBClient.getNaics({ code: newCompany.industry!.naics_code, numYears: 3 });
            newCompany.wsi_score = await calcWsiScore(newCompany, getNumWeights(), newNaics, true);
            
            companyInfos.push({
                company: newCompany,
                naics: newNaics,
                allFactors: newCompany.wsi_score?.allFactors,
            });
            setCompanyInfos(companyInfos.slice());
        } catch (ex) {
            console.error('Something went wrong', ex);
        }
        
        setIsLoadingCompany(false);
    }

    useEffect(() => {
        const numWeights = getNumWeights();

        for (let i = 0; i < companyInfos.length; i++) {
            calcWsiScore(companyInfos[i].company, numWeights, companyInfos[i].naics, true).then(s => {
                if (companyInfos[i].company.wsi_score?.score != s?.score) {
                    companyInfos[i].company.wsi_score = s;
                    companyInfos[i].allFactors = s?.allFactors!;
                    setCompanyInfos(companyInfos.slice());
                }
            });
        }
    }, [weights]);

    const [isConfirmingSave, setIsConfirmingSave] = useState(false);
    const [progress, setProgress] = useState(null as Payloads.IProgressResponse | null);

    useEffect(() => {
        if (progress) {
            setTimeout(() => {
                DBClient.saveScoreWeights({ nonce: progress.nonce }).then(p => {
                    if (p) {
                        setProgress(p);
                    }
                });
            }, 5000);
        }
    }, [progress]);

    return <>
        <Head>
            <title>Score editor | Work Safety Index</title>
        </Head>

        <main className="max-w-screen-xl mx-auto px-4 py-8">
            {progress == null && (<>
                <h1 className='text-2xl font-light'>Score editor</h1>
                <div className="flex flex-col gap-2 w-full p-4 bg-zinc-100 rounded-lg">
                    <div className="grid md:grid-cols-2 items-center gap-2">
                        <div>
                            <div>Max weight multiplier</div>
                            <div className='text-sm text-zinc-500'>The maximum a single factor can affect the score, as a multiple of its base weight.</div>
                            <div className='text-sm text-zinc-500'>A max multiplier of 3 would mean a weight of 2 could only subract a maximum of</div>
                            <div className='text-sm text-zinc-500'>2 * 3 = 6 from the score.</div>
                        </div>
                        <input
                            type="tel"
                            className="w-full"
                            value={weights.maxMultiplier}
                            onChange={e => {
                                weights.maxMultiplier = e.target.value;
                                setWeights(Object.assign({}, weights));
                            }}
                        />
                    </div>

                    <div className="grid md:grid-cols-3 items-center gap-2 mt-2 -mx-4 px-4 py-3 font-light text-lg bg-zinc-200">
                        <div>Factor</div>
                        <div>Weight</div>
                        <div>Max ({FACTORS.reduce((prev, f) => prev + (coerceFloat(weights[f]) * coerceFloat(weights.maxMultiplier)), 0).toFixed(1)})</div>
                    </div>
                    {FACTORS.map(f => (
                        <div
                            key={f}
                            className='grid md:grid-cols-3 items-center gap-2'
                        >
                            <div>{humanizeScoreMetric(f)}</div>
                            <div>
                                <input
                                    type="tel"
                                    name={f}
                                    id={f}
                                    className="w-full"
                                    value={weights[f]}
                                    onChange={e => {
                                        weights[f] = e.target.value;
                                        setWeights(Object.assign({}, weights));
                                    }}
                                />
                            </div>
                            <div className='p-2 bg-zinc-200 border-2 border-zinc-300 rounded-md'>
                                {coerceFloat(weights[f]) * coerceFloat(weights.maxMultiplier)}
                            </div>
                        </div>
                    ))}
                </div>
                
                <div className="flex flex-col items-center mt-4">
                    {!isConfirmingSave && (
                        <button
                            className="_primary"
                            onClick={setIsConfirmingSave.bind(null, true)}
                        >
                            Save
                        </button>
                    ) || (
                        <div className='flex flex-col items-center w-full p-4 bg-zinc-100 rounded-lg'>
                            <div>Save and update all companies? This can take some time.</div>
                            <div className="flex gap-2 mt-2">
                                <button
                                    onClick={setIsConfirmingSave.bind(null, false)}
                                >
                                    Cancel
                                </button>
                                <button
                                    className="_primary"
                                    onClick={() => {
                                        DBClient.saveScoreWeights({ weights: getNumWeights() }).then(setProgress);
                                    }}
                                >
                                    Confirm
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                <h1 className="mt-6 text-2xl font-light">Preview</h1>
                <div className="relative flex flex-col gap-4 p-4 bg-zinc-100 rounded-lg">
                    <SearchBar onSelect={loadCompany} clearOnSelect hideRecent />
                    <>
                        {companyInfos.map((i, idx) => (
                            <div
                                key={i.company.id}
                                className='p-2 border-2 border-zinc-200 rounded-lg'
                            >
                                <div className="flex">
                                    <button
                                        className="_icon"
                                        onClick={() => {
                                            companyInfos.splice(companyInfos.findIndex(curC => curC.company.id == i.company.id), 1);
                                            setCompanyInfos(companyInfos.slice());
                                        }}
                                    >
                                        <Close />
                                    </button>
                                    <CompanyCard company={i.company} spacing='normal' />
                                </div>
                                {i.allFactors && (
                                    <div className="flex flex-wrap justify-between gap-1 w-full mt-2">
                                        {FACTORS.filter(f => f != 'maxMultiplier').map(f => (
                                            <div
                                                key={f}
                                                className='p-2 bg-zinc-200 rounded'
                                            >
                                                <div className='text-sm'>{humanizeScoreMetric(f)}</div>
                                                <div>{(i.allFactors![f as 'trir'] || 0).toFixed(1)}</div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
                    </>
                    {isLoadingCompany && (
                        <div className="absolute flex justify-center items-center top-0 left-0 w-full h-full bg-zinc-100/50">
                            <Loader />
                        </div>
                    )}
                </div>
            </>) || (<>
                <h1 className="text-2xl font-light">Recalculating all scores</h1>
                <div className="p-4 bg-zinc-100 rounded-lg">
                    <div className='flex gap-2'>
                        <span className="font-semibold">Progress:</span>

                        <span>{progress!.completed == progress!.total ? 'Done!' : `${Math.floor(progress!.completed / progress!.total * 100)}%`}</span>
                    </div>
                    <div className="md:w-1/2 h-9 mt-2 bg-white rounded-lg overflow-hidden">
                        <div
                            className="w-0 h-full bg-primary transition-all duration-500"
                            style={{ width: `${Math.floor(progress!.completed / progress!.total * 100)}%` }}
                        ></div>
                    </div>
                    <div className="md:w-1/2 mt-2">
                        Processing will continue if you navigate away from this page, but you will not be able to return to see its progress.
                    </div>
                </div>
            </>)}
        </main>
    </>;
}

interface IProps {
    weights: IWsiScoreWeights;
}

interface ICompanyInfos {
    company: ICompany;
    naics: INAICS[string][];
    allFactors?: NonNullable<IWsiScore['allFactors']>;
}

export default Page;