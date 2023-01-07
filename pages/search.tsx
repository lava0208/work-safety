import type { NextPage, GetServerSideProps } from 'next';
import Head from 'next/head';
import { useEffect, useState } from 'react';
import { CompanyCard } from '../components/company-card';
import * as DBServer from '../utils/db-server';
import * as DBClient from '../utils/db-client';
import { ICompany_Search, DBTypes, ISearchRecord, getUrlParam, delimitNum, pluralize } from '../utils/wsi';
import { LoadBtn } from '../components/load-btn';

export const getServerSideProps: GetServerSideProps = async (context) => {
    const searchStr = (context.query).s as IProps['search'];
    const sort = ((context.query).sort || 'relevance') as IProps['sort'];
    const searchResult = await DBServer.search({ search: searchStr || '', mode: 'search', sort: sort, });

    const props: IProps = {
        mode: 'search',
        search: searchStr,
        sort: sort,
        companies: searchResult.results,
        totalCount: searchResult.totalCount,
        searchId: searchResult.searchId,
        hasMore: searchResult.hasMore,
    };

    return {
        props: props,
    };
}

const Page: NextPage<IProps> = (props: IProps) => {
    const [companies, setCompanies] = useState(props.companies);
    const [searchId, setSearchId] = useState(props.searchId);
    const [hasMore, setHasMore] = useState(props.hasMore);

    const [related, setRelated] = useState(null as ICompany_Search[] | null); //null = has not finished requesting data. [] = finished requesting; found no data.
    useEffect(() => {
        if (props.searchId) { //Don't use the state version of searchId since we don't want this updating each time additional main reults are loaded
            DBClient.search({
                mode: 'related',
                search: props.searchId,
            })
                .then(r => {
                    setRelated(r.results);
                })
                .catch(setRelated.bind(null, []));
        } else {
            setRelated([]);
        }
    }, [props.searchId, getUrlParam('s')]);

    function setSort(sort: DBTypes.SearchSort) {
        if (sort != props.sort) {
            const url = new URL(window.location.href);
            url.searchParams.set('sort', sort);
            window.location.href = url.toString();
        }
    }

    return <>
        <Head>
            <title>{`Search | Work Safety Index`}</title>
            <meta property="og:title" content={`Search for ${props.search} | Work Safety Index`} />
            <meta
                name="description"
                key="desc"
                content={`View results for ${props.search}. Companies, locations, and safety statistics: injuries, days away from work, and deaths.`}
            />
            <meta
                property="og:description"
                content={`View results for ${props.search}. Companies, locations, and safety statistics: injuries, days away from work, and deaths.`}
            />
        </Head>

        <div className='flex justify-center py-2 bg-zinc-100 rounded'>
            <div className="flex items-center gap-2 w-full max-w-screen-xl px-4">
                <span>
                    Showing results for <span className='font-semibold'>{props.search || `''`}</span>
                </span>
                <span>-</span>
                <span className="text-sm">{delimitNum(props.totalCount)} {pluralize('result', props.totalCount)}</span>
            </div>
        </div>

        <main className="grid grid-cols-1 md:grid-cols-[3fr,_1fr] gap-4 max-w-screen-xl mx-auto px-2 md:px-4 pt-4 pb-8">
            <div>
                <div className='h-16 border-b-2 border-zinc-200'>
                    <div className='text-sm font-semibold'>Sort by</div>
                    <div className="flex justify-between items-center mt-1">
                        <div>
                            <button
                                className={`${props.sort == 'relevance' ? '_primary' : ''} mr-1 px-2 py-1`}
                                onClick={setSort.bind(null, 'relevance')}
                            >
                                Relevance
                            </button>
                            <button
                                className={`${props.sort == 'safety' ? '_primary' : ''} mr-1 px-2 py-1`}
                                onClick={setSort.bind(null, 'safety')}
                            >
                                SafetyScore
                            </button>
                        </div>
                        <h2 className="mr-2 w-[4.4rem] text-zinc-500 text-xs font-semibold text-center leading-none">
                            SafetyScore
                        </h2>
                    </div>
                </div>
                <div className='grid grid-cols-1 gap-2'>
                    {companies.length > 0 && (<>
                        {companies.map(l => (
                            <CompanyCard company={l} spacing='normal' key={l.id} />
                        ))}

                        {hasMore && (
                            <div className='flex justify-center mt-4'>
                                <LoadBtn
                                    caption='Load more'
                                    onClick={() => {
                                        return DBClient.search({ mode: 'paginate', search: searchId! })
                                        .then(result => {
                                            setCompanies(companies.concat(result.results));
                                            setSearchId(result.searchId);
                                            setHasMore(result.hasMore);
                                        });
                                    }}
                                />
                            </div>
                        )}
                    </>) || (
                        <div className='flex justify-center p-4'>No results match your search</div>
                    )}
                </div>
            </div>
            <div>
                <div className="flex items-end h-16 pb-2 border-b-2 border-zinc-200">
                    <h1 className='text-lg font-light'>Related</h1>
                </div>
                <div className='grid grid-cols-1 gap-2'>
                    {related?.map(l => (
                        <CompanyCard company={l} spacing='tight' hideLogo key={l.id} />
                    ))}
                    {related == null && (
                        <div className='flex flex-col justify-between mt-2 p-2 h-20 bg-zinc-100/50 animate-pulse rounded'>
                            <div className="h-2 w-1/2 bg-zinc-100 rounded"></div>
                            <div className="h-6 w-1/3 bg-zinc-100 rounded"></div>
                            <div className="h-3 w-2/3 bg-zinc-100 rounded"></div>
                        </div>
                    )}
                </div>
            </div>
        </main>
    </>
}

interface IProps extends Partial<DBTypes.ISearchOps> {
    searchId: ISearchRecord['id'] | null;
    companies: ICompany_Search[];
    totalCount: number;
    hasMore: boolean;
}

export default Page