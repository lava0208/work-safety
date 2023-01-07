import { GetServerSideProps, NextPage } from 'next';
import Head from 'next/head';
import { ICompany, ISpotlightIndustries, pluralize } from '../utils/wsi';
import * as DBServer from '../utils/db-server';
import { NavLink } from '../components/nav-link';
import { Score } from '../components/score';
import { SearchBar } from '../components/search-bar';
import { ChevronBack, ChevronForward } from 'react-ionicons';
import { useEffect, useRef, useState } from 'react';

const SCROLL_MULTIPLIER = 0.45;

export const getServerSideProps: GetServerSideProps = async (context) => {
    const spotlight = await DBServer.getStaticRecord<ISpotlightIndustries>('spotlight_industries');
    const bestOfCats: ISpotlightIndustries['industries'] = [];
    const proms = [
        DBServer.getCompanies({ preset: 'mostPopular', limit: 3, }),
    ];
    
    if (spotlight) {
        while (bestOfCats.length < 3) {
            let cat = spotlight.industries[(Math.floor(Math.random() * spotlight.industries.length))];
            if (!bestOfCats.includes(cat)) {
                bestOfCats.push(cat);
                proms.push(DBServer.getCompanies({ preset: 'safest', naics_code: cat.code, limit: 10, }));
            }
        }
    }

    return Promise.all(proms)
    .then(results => {
        return {
            props: {
                mostPopular: results[0] || [],
                bestOfs: bestOfCats.map((c, idx) => {
                    return {
                        category: c,
                        companies: results[idx + 1],
                    };
                })
            } as IProps,
        };
    })
    .catch(() => {
        return {
            props: {
                mostPopular: [],
                bestOfs: [],
            } as IProps,
        };
    });
}

const Page: NextPage<IProps> = (props) => {
    const carouselRefs = props.bestOfs.map(b => useRef<HTMLDivElement>());
    const [scrollPositions, setScrollPositions] = useState(props.bestOfs.map(b => 0) as number[]); //Positions of the "Safest" section carousels
    
    const [_arrowHovered, _setArrowHovered] = useState(-1);
    const arrowHovered = useRef(_arrowHovered);
    function setArrowHovered(n: number) {
        _setArrowHovered(n);
        arrowHovered.current = n;
    }

    useEffect(() => {
        if (arrowHovered.current >= 0 && arrowHovered.current < props.bestOfs.length * 2) {
            let prevT: number | null = null;
            
            let anim = (t: number) => {
                if (arrowHovered.current == -1) {
                    return;
                }

                if (prevT == null) {
                    prevT = t;
                }
                const dt = t - prevT;
                prevT = t;

                const ref = carouselRefs[arrowHovered.current % props.bestOfs.length];
                if (ref?.current) {
                    ref.current.scrollBy({
                        left: (arrowHovered.current < props.bestOfs.length ? -1 : 1) * dt * SCROLL_MULTIPLIER,
                    });
                }

                if (arrowHovered.current >= 0 && arrowHovered.current < props.bestOfs.length * 2) {
                    requestAnimationFrame(anim);
                }
            }

            requestAnimationFrame(anim);
        }
    }, [arrowHovered.current]);

    return <>
        <Head>
            <title>Work Safety Index</title>
        </Head>

        <main className='pb-10'>
            <header
                className='relative flex justify-center items-center px-4 py-32 bg-center bg-cover text-white'
                style={{ backgroundImage: `url('header hat.jpg')` }}
            >
                <div className="absolute top-0 left-0 w-full h-full bg-zinc-900/60 z-0"></div>
                
                <div className="flex flex-col justify-center items-center gap-10 w-full z-10">
                    <h1 className="text-5xl font-semibold">Safety in numbers</h1>
                    <div className="md:w-1/2 lg:w-1/4 md:text-center">
                        <h3 className="text-lg">Safety statistics to help you build business relationships that last</h3>
                    </div>
                    <div
                        className='w-full md:w-1/2 max-w-screen-md text-lg text-zinc-900'
                    >
                        <SearchBar onSelect={place => {
                            location.href = `/summary/${place}`;
                        }} />
                    </div>
                </div>
            </header>

            <div className="flex flex-col gap-10 max-w-screen-xl mx-auto mt-10 px-4">
                {props.mostPopular.length > 0 && (
                    <div className="w-full">
                        <h1 className="text-2xl font-light">Popular companies</h1>
                        <div className="grid md:grid-cols-3 gap-4 mt-2">
                            {props.mostPopular.map(c => (
                                <NavLink
                                    key={c.id}
                                    href={`/summary/${c.place}`}
                                >
                                    <div
                                        key={c.id}
                                        className="flex flex-col justify-between items-center gap-4 p-4 text-center border-2 border-primary rounded-lg cursor-pointer"
                                    >
                                        {c.wsi_score && (
                                            <Score score={c.wsi_score.score} size={3.5} />
                                        )}

                                        <div className="flex items-center gap-2">
                                            {c.logo?.h96 && (
                                                <div
                                                    className="w-10 h-10 bg-contain bg-center"
                                                    style={{ backgroundImage: `url('${c.logo.h96}')` }}
                                                ></div>
                                            )}
                                            <h2 className="text-xl leading-none">{c.company_name}</h2>
                                        </div>

                                        <span className="-mt-2 px-4 text-sm text-zinc-500 leading-none">{c.industry?.caption}</span>
                                    </div>
                                </NavLink>
                            ))}
                        </div>
                    </div>
                )}
                
                {props.bestOfs.length > 0 && (
                    <div className="flex flex-col gap-4">
                        {props.bestOfs.map((b, idx) => (
                            <div
                                key={b.category.code}
                                className="w-full"
                            >
                                <div className="px-4 pt-6 rounded-lg">
                                    <h2 className='text-2xl font-light text-center'>Safest {b.category.caption}</h2>
                                    <div className="flex gap-2">
                                        <div
                                            className="hidden md:flex justify-center items-center bg-zinc-100 opacity-40 hover:opacity-100 rounded transition cursor-pointer"
                                            onMouseOver={setArrowHovered.bind(null, idx)}
                                            onMouseOut={setArrowHovered.bind(null, -1)}
                                            onTouchStart={setArrowHovered.bind(null, idx)}
                                            onTouchEnd={setArrowHovered.bind(null, -1)}
                                        >
                                            <ChevronBack color='' width='1.75rem' height='1.75rem' cssClasses={'text-zinc-900 fill-zinc-900'} />
                                        </div>
                                        <div
                                            ref={carouselRefs[idx] as any}
                                            className="grow mt-2 pb-4 overflow-x-scroll"
                                            onScroll={e => {
                                                scrollPositions[idx] = (e.target as HTMLDivElement).scrollLeft;
                                                setScrollPositions(scrollPositions.slice())
                                            }}
                                            
                                        >
                                            <div className="flex gap-2">
                                                {b.companies.map((c, idx) => (
                                                    <div
                                                        key={c.id}
                                                        className="shrink-0 flex items-center gap-4 w-60 md:w-80 p-4 bg-zinc-100 rounded"
                                                    >
                                                        {c.wsi_score && (
                                                            <Score score={c.wsi_score.score} size={3.5} />
                                                        )}
                                                        <div className='grow flex flex-col justify-evenly'>
                                                            <NavLink href={`/summary/${c.place}`}>
                                                                <h2 className="text-xl text-primary leading-none">{c.company_name}</h2>
                                                            </NavLink>
                                                            <div className="mt-1 text-sm text-zinc-500">{`${c.total_incidents} ${pluralize('incident', c.total_incidents)} in ${c.year_filing_for}`}</div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                        <div
                                            className="hidden md:flex justify-center items-center bg-zinc-100 opacity-40 hover:opacity-100 rounded transition cursor-pointer"
                                            onMouseOver={setArrowHovered.bind(null, props.bestOfs.length + idx)}
                                            onMouseOut={setArrowHovered.bind(null, -1)}
                                            onTouchStart={setArrowHovered.bind(null, props.bestOfs.length + idx)}
                                            onTouchEnd={setArrowHovered.bind(null, -1)}
                                        >
                                            <ChevronForward color='' width='1.75rem' height='1.75rem' cssClasses={'text-zinc-900 fill-zinc-900'} />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </main>
    </>;
}

interface IProps {
    mostPopular: ICompany[];
    bestOfs: {
        category: ISpotlightIndustries['industries'][number];
        companies: ICompany[];
    }[];
}

export default Page;