import { useState, useEffect, useRef, useContext } from 'react';
import { GetServerSideProps, NextPage } from 'next';
import Head from 'next/head';
import { ICompany, ILocation, pluralize, showTooltip } from '../../utils/wsi';
import { LocationCard, FIELDS as LOC_FIELDS } from '../../components/location-card';
import { BizHeader } from '../../components/biz-header';
import { Loader } from '../../components/loader';
import { LoadBtn } from '../../components/load-btn';
import * as DBServer from '../../utils/db-server';
import * as DBClient from '../../utils/db-client';
import { useRouter } from 'next/router';
import { ArrowDown, ArrowUp } from 'react-ionicons';
import { GlobalContext } from '../../contexts/global';

const LIMIT = 36;

export const getServerSideProps: GetServerSideProps = async (context) => {
    if (!context.params?.place) {
        return {
            notFound: true,
        };
    }

    return DBServer.getCompanies({ place: context.params?.place as string }).then(companies => {
        if (companies?.length > 0) {
            return DBServer.getLocations({ relatedTo: companies[0], orderBy: 'state', order: 'ASC', offset: 0, limit: LIMIT, project: LOC_FIELDS }).then(locs => {
                if (locs?.length > 0) {
                    return {
                        props: {
                            companies: companies,
                            locs,
                            sort: context.query.sort || 'state',
                            order: context.query.order || 'ASC',
                            filter: context.query.filter || '',
                        } as IProps,
                    };
                } else {
                    return {
                        notFound: true,
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
    const router = useRouter();
    const { isAdmin } = useContext(GlobalContext);

    const mainCompany = props.companies[0];
    
    const [locations, setLocations] = useState(props.locs);
    const [locationFilter, setLocationFilter] = useState(props.filter || '');
    const [orderBy, setOrderBy] = useState((['state', 'establishment_name', 'annual_average_employees', 'total_incidents'].includes(props.sort) ? props.sort : 'state') as Sort);
    const [order, setOrder] = useState((['ASC', 'DESC'].includes(props.order) ? props.order : 'ASC') as 'ASC' | 'DESC');
    const [isRequesting, setIsRequesting] = useState(false);
    const [offset, setOffset] = useState(0);
    const [hasMore, setHasMore] = useState(true);
    useEffect(() => {
        if (isFirstRender.current) {
            return;
        }

        setIsRequesting(true);
        DBClient.getLocations({ relatedTo: mainCompany, search: locationFilter, orderBy, order, offset, limit: LIMIT, project: LOC_FIELDS })
            .then(newLocs => {
                if (offset > 0) {
                    setLocations(locations.concat(newLocs));
                } else {
                    setLocations(newLocs);
                }

                if (newLocs.length < LIMIT) {
                    setHasMore(false);
                }
            })
            .catch(setLocations.bind(null, []))
            .finally(setIsRequesting.bind(null, false));
    }, [locationFilter, orderBy, order, offset]);

    const [filterVal, setFilterVal] = useState(props.filter || '');
    useEffect(() => {
        let timer: number | null = window.setTimeout(() => {
            timer = null;
            setLocationFilter(filterVal);
            setOffset(0);
        }, 300);

        return () => {
            if (timer != null) {
                window.clearTimeout(timer);
            }
        }
    }, [filterVal]);

    function sortClicked(s: Sort) {
        if (orderBy == s) {
            setOrder(order == 'ASC' ? 'DESC' : 'ASC');
        } else {
            setOrderBy(s);
            if (s == 'annual_average_employees' || s == 'total_incidents') {
                setOrder('DESC');
            } else {
                setOrder('ASC');
            }
        }
        setOffset(0);
    }

    useEffect(() => {
        router.replace({
            pathname: location.pathname,
            query: {
                sort: orderBy,
                order: order,
                filter: locationFilter,
            },
        });
    }, [orderBy, order, locationFilter]);

    const [selected, setSelected] = useState([] as ILocation['id'][]);
    const [isEditing, setIsEditing] = useState(false);
    const [isMerging, setIsMerging] = useState(false);

    async function finishEdit() {
        if (selected.length == 0) {
            return;
        }

        return DBClient.download({ locations: selected, })
        .then(r => {
            const downloadLink = document.createElement('a');
            downloadLink.href = r.filename;
            downloadLink.click();

            showTooltip('Download started. You will now be redirected to the admin page where you can upload your edited file.', null, 4000);

            setTimeout(() => {
                router.push('/upload', undefined, { shallow: false });
            }, 4500);
        });
    }
    
    async function finishMerge() {
        if (selected.length == 0) {
            return;
        }

        return DBClient.mergeLocations({ ids: selected, })
        .then(r => {
            showTooltip('Merge finished. Reloading.');
            setTimeout(() => {
                location.reload();
            }, 2500);
        });
    }
    
    const isFirstRender = useRef(true);
    useEffect(() => {
        isFirstRender.current = false;
    }, []);

    return <>
        <Head>
            <title>{`All ${mainCompany.company_name} Locations | Work Safety Index`}</title>
            <meta property="og:title" content={`${mainCompany.company_name} locations | Work Safety Index`} />
            <meta
                name="description"
                key="desc"
                content={`View ${mainCompany.num_locations} ${mainCompany.company_name} locations`}
            />
            <meta
                property="og:description"
                content={`View ${mainCompany.num_locations} ${mainCompany.company_name} locations`}
            />
        </Head>

        <main className="max-w-screen-xl mx-auto px-4 pt-8 pb-12">
            <BizHeader company={mainCompany} tab='locations' />

            {isAdmin && (
                <div className='bg-zinc-100 mt-4 -mb-6 p-4 rounded-t-lg'>
                    <div className='flex items-center gap-2 mt-2'>
                        {!isEditing && !isMerging && (<>
                            <button className='_primary' onClick={setIsEditing.bind(null, true)}>Edit</button>
                            <button className='_primary' onClick={setIsMerging.bind(null, true)}>Merge</button>
                        </>) || isEditing && (<>
                            <LoadBtn
                                caption={`Edit ${selected.length} ${pluralize('location', selected.length)}`}
                                onClick={finishEdit}
                                disabled={selected.length == 0}
                            />
                            <button
                                className='bg-white'
                                onClick={setSelected.bind(null, [])}
                                disabled={selected.length == 0}
                            >
                                Deselect
                            </button>
                            <button className='bg-white' onClick={setIsEditing.bind(null, false)}>Cancel</button>
                            <div className='px-1'>Select all locations you want to edit</div>
                        </>) || isMerging && (<>
                            <LoadBtn
                                caption={`Merge ${selected.length} ${pluralize('location', selected.length)}`}
                                onClick={finishMerge}
                                disabled={selected.length == 0}
                            />
                            <button
                                className='bg-white'
                                onClick={setSelected.bind(null, [])}
                                disabled={selected.length == 0}
                            >
                                Deselect
                            </button>
                            <button className='bg-white' onClick={setIsMerging.bind(null, false)}>Cancel</button>
                            <div className='px-1'>Select all locations you want to merge into one. The first selection will become primary.</div>
                        </>)}
                    </div>
                </div>
            )}

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 mt-4 p-4 bg-zinc-100 rounded-lg">
                <div className='-mt-1'>
                    <div className='text-sm font-semibold'>Sort by</div>
                    <div className="flex flex-wrap gap-2 mt-1">
                        <button
                            className={`${orderBy == 'state' ? '_primary' : 'bg-white'} flex items-center px-2 py-1`}
                            onClick={sortClicked.bind(null, 'state')}
                        >
                            <span>
                                Location
                            </span>
                            {orderBy == 'state' && (
                                <span className="ml-1">
                                    {order == 'ASC' && (
                                        <ArrowUp color='' width='0.9rem' height='0.9rem' cssClasses='text-white fill-white' />
                                    ) || (
                                        <ArrowDown color='' width='0.9rem' height='0.9rem' cssClasses='text-white fill-white' />
                                    )}
                                </span>
                            )}
                        </button>
                        <button
                            className={`${orderBy == 'establishment_name' ? '_primary' : 'bg-white'} flex items-center px-2 py-1`}
                            onClick={sortClicked.bind(null, 'establishment_name')}
                        >
                            <span>
                                Name
                            </span>
                            {orderBy == 'establishment_name' && (
                                <span className="ml-1">
                                    {order == 'ASC' && (
                                        <ArrowUp color='' width='0.9rem' height='0.9rem' cssClasses='text-white fill-white' />
                                    ) || (
                                        <ArrowDown color='' width='0.9rem' height='0.9rem' cssClasses='text-white fill-white' />
                                    )}
                                </span>
                            )}
                        </button>
                        <button
                            className={`${orderBy == 'annual_average_employees' ? '_primary' : 'bg-white'} flex items-center px-2 py-1`}
                            onClick={sortClicked.bind(null, 'annual_average_employees')}
                        >
                            <span>
                                Employees
                            </span>
                            {orderBy == 'annual_average_employees' && (
                                <span className="ml-1">
                                    {order == 'ASC' && (
                                        <ArrowUp color='' width='0.9rem' height='0.9rem' cssClasses='text-white fill-white' />
                                    ) || (
                                        <ArrowDown color='' width='0.9rem' height='0.9rem' cssClasses='text-white fill-white' />
                                    )}
                                </span>
                            )}
                        </button>
                        <button
                            className={`${orderBy == 'total_incidents' ? '_primary' : 'bg-white'} flex items-center px-2 py-1`}
                            onClick={sortClicked.bind(null, 'total_incidents')}
                        >
                            <span>
                                Incidents
                            </span>
                            {orderBy == 'total_incidents' && (
                                <span className="ml-1">
                                    {order == 'ASC' && (
                                        <ArrowUp color='' width='0.9rem' height='0.9rem' cssClasses='text-white fill-white' />
                                    ) || (
                                        <ArrowDown color='' width='0.9rem' height='0.9rem' cssClasses='text-white fill-white' />
                                    )}
                                </span>
                            )}
                        </button>
                    </div>
                </div>

                <div className='w-80 max-w-full'>
                    <input type="text" placeholder='Filter' className='w-full' value={filterVal} onChange={e => { setFilterVal(e.target.value) }} />
                </div>
            </div>

            <div className='relative'>
                <div className={`${isRequesting ? 'opacity-25' : 'opacity-100'} grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-2 transition`}>
                    {locations.map(l => {
                        return (
                            <div
                                key={l.id}
                                className='relative border-2 border-zinc-200 rounded-lg shadow'
                            >
                                <LocationCard location={l} className='h-full px-4' />
                                {(isEditing || isMerging) && (
                                    <div
                                        className="absolute top-0 left-0 w-full h-full p-1 cursor-pointer"
                                        onClick={() => {
                                            if (selected.includes(l.id)) {
                                                selected.splice(selected.indexOf(l.id), 1);
                                            } else {
                                                selected.push(l.id);
                                            }
                                            setSelected(selected.slice());
                                        }}
                                    >
                                        <div className={`${selected.includes(l.id) ? 'bg-primary/20 border-primary border-solid' : 'bg-white/30 border-zinc-400 border-dotted'} w-full h-full border-2 rounded-md`}></div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                {isRequesting && (
                    <div className="absolute top-0 left-0 flex justify-center items-center w-full h-full">
                        <Loader size={3} />
                    </div>
                )}
            </div>

            {hasMore && (
                <div className="flex justify-center mt-6">
                    <button
                        className=''
                        disabled={isRequesting}
                        onClick={setOffset.bind(null, offset + LIMIT)}
                    >
                        Load more
                    </button>
                </div>
            )}
        </main>
    </>;
}

type Sort = 'state' | 'establishment_name' | 'annual_average_employees' | 'total_incidents';

interface IProps {
    companies: ICompany[]; //[0] is the newest, [end] is the oldest
    locs: ILocation[];
    sort: Sort;
    order: 'ASC' | 'DESC';
    filter: string;
}

export default Page;