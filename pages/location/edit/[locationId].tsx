import { GetServerSideProps, NextPage } from 'next';
import Head from 'next/head';
import { NavLink } from '../../../components/nav-link';
import { ILocation, coerceNumber, showTooltip, pluralize, coerceString } from '../../../utils/wsi';
import * as DBServer from '../../../utils/db-server';
import * as DBClient from '../../../utils/db-client';
import { ChangeEvent, useState } from 'react';
import { LoadBtn } from '../../../components/load-btn';
import { isAdmin } from '../../api/login';

export const getServerSideProps: GetServerSideProps = async (context) => {
    if (!(await isAdmin(undefined, undefined, context.req.cookies))) {
        return {
            redirect: {
                destination: '/login',
                permanent: false,
            }
        };
    }

    if (!context.params?.locationId) {
        return {
            notFound: true,
        };
    }

    return await DBServer.getLocations({ locationId: context.params?.locationId as ILocation['locationId'], orderBy: 'year_filing_for', })
    .then(locs => {
        if (locs?.length > 0) {
            return {
                props: {
                    locs,
                } as IProps
            };
        } else {
            return {
                notFound: true,
            };
        }
    });
}

const METADATA_FIELDS: { key: keyof (ILocation & NonNullable<ILocation['industry']>), caption: string, type: 'string' | 'number' }[] = [
    { key: 'company_name', caption: 'Company name', type: 'string', },
    { key: 'establishment_name', caption: 'Establishment name', type: 'string', },
    { key: 'ein', caption: 'EIN', type: 'string', },
    { key: 'naics_code', caption: 'NAICS code', type: 'number', },
    { key: 'caption', caption: 'Industry caption', type: 'string', },
    { key: 'street_address', caption: 'Street address', type: 'string', },
    { key: 'city', caption: 'City', type: 'string', },
    { key: 'state', caption: 'State', type: 'string', },
    { key: 'zip_code', caption: 'Zip code', type: 'number', },
];

const MAIN_FIELDS: { key: keyof ILocation, caption: string, type: 'string' | 'number' }[] = [
    { key: 'annual_average_employees', caption: 'Annual average employees', type: 'number', },
    { key: 'total_hours_worked', caption: 'Total hours worked', type: 'number', },
    { key: 'total_incidents', caption: 'Total incidents', type: 'number', },
    { key: 'total_deaths', caption: 'Total deaths', type: 'number', },
    { key: 'total_injuries', caption: 'Total injuries', type: 'number', },
    { key: 'total_dafw_cases', caption: 'DAFW (cases)', type: 'number', },
    { key: 'total_djtr_cases', caption: 'DJTR (cases)', type: 'number', },
    { key: 'total_dafw_days', caption: 'DAFW (days)', type: 'number', },
    { key: 'total_djtr_days', caption: 'DJTR (days)', type: 'number', },
    { key: 'total_poisonings', caption: 'Total poisonings', type: 'number', },
    { key: 'total_respiratory_conditions', caption: 'Total respieratory Conditions', type: 'number', },
    { key: 'total_skin_disorders', caption: 'Total skin disorders', type: 'number', },
    { key: 'total_hearing_loss', caption: 'Total hearing loss', type: 'number', },
    { key: 'total_other_illnesses', caption: 'Total other illnesses', type: 'number', },
];

const ARCHIVE_FIELDS: { key: keyof NonNullable<ILocation['archive']>, caption: string, type: 'string' | 'number' }[] = [
    { key: 'no_injuries_illnesses', caption: 'Number injuries & illnesses', type: 'number', },
    { key: 'total_other_cases', caption: 'Total other cases', type: 'number', },
    { key: 'establishment_id', caption: 'Establishment ID', type: 'string', },
];

const DISABLED_FIELDS: (typeof METADATA_FIELDS)[number]['key'][] = ['company_name'];

const ALL_FIELDS: { key: keyof (ILocation & NonNullable<ILocation['industry']> & NonNullable<ILocation['archive']>), caption: string, type: 'string' | 'number' }[]
= ([] as any).concat(METADATA_FIELDS).concat(MAIN_FIELDS).concat(ARCHIVE_FIELDS);

const Page: NextPage<IProps> = (props) => {
    const [locs, setLocs] = useState(props.locs);
    const [idx, setIdx] = useState(0);

    const [focus, setFocus] = useState(null as typeof ALL_FIELDS[number]['key'] | null);

    function extractVal(key: typeof ALL_FIELDS[number]['key']): string | number | undefined {
        switch (key) {
            case 'naics_code':
                return locs[idx].industry?.naics_code;
            case 'caption':
                return locs[idx].industry?.caption;
            case 'establishment_name':
            case 'ein':
            case 'company_name':
            case 'street_address':
            case 'city':
            case 'state':
            case 'zip_code':
            case 'annual_average_employees':
            case 'total_hours_worked':
            case 'total_incidents':
            case 'total_deaths':
            case 'total_injuries':
            case 'total_dafw_cases':
            case 'total_djtr_cases':
            case 'total_dafw_days':
            case 'total_djtr_days':
            case 'total_poisonings':
            case 'total_respiratory_conditions':
            case 'total_skin_disorders':
            case 'total_hearing_loss':
            case 'total_other_illnesses':
                return locs[idx][key];
            case 'no_injuries_illnesses':
            case 'total_other_cases':
            case 'establishment_id':
                return locs[idx].archive ? locs[idx].archive![key] : '';
        }
    }

    function inputChanged(e: ChangeEvent) {
        const key = e.target.getAttribute('data-key') as typeof ALL_FIELDS[number]['key'];
        const val = (e.target as HTMLInputElement).value;

        switch (key) {
            case 'naics_code':
                locs[idx].industry = locs[idx].industry || {};
                locs[idx].industry!.naics_code = coerceNumber(val);
                break;
            case 'caption':
                locs[idx].industry = locs[idx].industry || {};
                locs[idx].industry!.caption = val;
                break;
            case 'establishment_name':
            case 'ein':
            case 'company_name':
            case 'street_address':
            case 'city':
            case 'state':
            case 'zip_code':
            case 'annual_average_employees':
            case 'total_hours_worked':
            case 'total_incidents':
            case 'total_deaths':
            case 'total_injuries':
            case 'total_dafw_cases':
            case 'total_djtr_cases':
            case 'total_dafw_days':
            case 'total_djtr_days':
            case 'total_poisonings':
            case 'total_respiratory_conditions':
            case 'total_skin_disorders':
            case 'total_hearing_loss':
            case 'total_other_illnesses':
                locs[idx][key as 'company_name'] = val;
                break;
            case 'no_injuries_illnesses':
            case 'total_other_cases':
            case 'establishment_id':
                locs[idx].archive = locs[idx].archive || {};
                locs[idx].archive![key as 'establishment_id'] = val;
                break;
        }

        setLocs(locs.slice());
    }

    async function saveClicked() {
        return new Promise<void>(async (resolve, reject) => {
            for (const loc of locs) {
                for (const key of ALL_FIELDS.map(f => f.key)) {
                    switch (key) {
                        case 'naics_code':
                            loc.industry = loc.industry || {};
                            loc.industry!.naics_code = coerceNumber(loc.industry.naics_code);
                            break;
                        case 'caption':
                            loc.industry = loc.industry || {};
                            loc.industry!.caption = coerceString(loc.industry.caption);
                            break;
                        case 'establishment_name':
                        case 'ein':
                        case 'company_name':
                        case 'street_address':
                        case 'city':
                        case 'state':
                        case 'zip_code':
                        case 'annual_average_employees':
                        case 'total_hours_worked':
                        case 'total_incidents':
                        case 'total_deaths':
                        case 'total_injuries':
                        case 'total_dafw_cases':
                        case 'total_djtr_cases':
                        case 'total_dafw_days':
                        case 'total_djtr_days':
                        case 'total_poisonings':
                        case 'total_respiratory_conditions':
                        case 'total_skin_disorders':
                        case 'total_hearing_loss':
                        case 'total_other_illnesses':
                            if (ALL_FIELDS.find(f => f.key == key)!.type == 'number') {
                                loc[key as 'total_hours_worked'] = coerceNumber(loc[key]) || 0;
                            } else {
                                loc[key as 'company_name'] = loc[key as 'company_name'];
                            }
                            break;
                        case 'no_injuries_illnesses':
                        case 'total_other_cases':
                        case 'establishment_id':
                            loc.archive = loc.archive || {};
                            if (ALL_FIELDS.find(f => f.key == key)!.type == 'number') {
                                loc.archive![key as 'no_injuries_illnesses'] = coerceNumber(loc.archive[key as 'no_injuries_illnesses']) || 0;
                            } else {
                                loc.archive![key as 'establishment_id'] = loc.archive[key as 'establishment_id'];
                            }
                            break;
                    }
                }
            }

            let prog = await DBClient.finishImport({
                locs
            });

            while (prog.completedTasks! < prog.totalTasks!) {
                await new Promise(res => {
                    setTimeout(res, 1000);
                });
                prog = await DBClient.finishImport(prog);
            }

            resolve();
            showTooltip('Your changes have been saved');
            location.href = `/location/${locs[idx].locationId}`;
        });
    }

    return <>
        <Head>
            <title>{`Edit ${locs[idx].establishment_name} | Work Safety Index`}</title>
        </Head>

        <main className="max-w-screen-xl mx-auto px-4 py-8">
            {locs[idx].establishment_name && (<>
                <h3 className='text-zinc-500 text-center'>{locs[idx].company_name}</h3>
                <h1 className='text-2xl font-light text-center'>{locs[idx].establishment_name}</h1>
            </>) || (
                <h1 className='text-2xl font-light text-center'>{locs[idx].company_name}</h1>
            )}

            <div className="flex justify-center gap-2 mt-4 overflow-x-auto">
                {locs.map((loc, curIdx) => (
                    <button
                        key={loc.year_filing_for}
                        className={curIdx == idx ? '_primary' : ''}
                        style={{ order: locs.length - curIdx }} //Oldest left, newest right
                        onClick={setIdx.bind(null, curIdx)}
                    >
                        {loc.year_filing_for}
                    </button>
                ))}
            </div>

            <div className="grid md:grid-cols-2 gap-x-8 gap-y-4 w-full mt-8 p-4 bg-zinc-100 rounded-lg">
                {METADATA_FIELDS.map(f => {
                    return (
                        <div
                            key={f.key}
                        >
                            <div className='text-zinc-600'>{f.caption}</div>
                            <input
                                type={f.type == 'string' ? 'text' : 'tel'}
                                className={`${focus == f.key ? 'bg-white' : 'bg-white'} w-full transition`}
                                onFocus={setFocus.bind(null, f.key)}
                                onBlur={setFocus.bind(null, null)}
                                value={extractVal(f.key)}
                                onChange={inputChanged}
                                data-key={f.key}
                                disabled={DISABLED_FIELDS.includes(f.key)}
                            />
                        </div>
                    )
                })}
            </div>
            <div className="grid md:grid-cols-2 gap-x-8 gap-y-4 w-full mt-8 p-4 bg-zinc-100 rounded-lg">
                {MAIN_FIELDS.map(f => {
                    return (
                        <div
                            key={f.key}
                        >
                            <div className='text-zinc-600'>{f.caption}</div>
                            <input
                                type={f.type == 'string' ? 'text' : 'tel'}
                                className={`${focus == f.key ? 'bg-white' : 'bg-white'} w-full transition`}
                                onFocus={setFocus.bind(null, f.key)}
                                onBlur={setFocus.bind(null, null)}
                                value={extractVal(f.key)}
                                onChange={inputChanged}
                                data-key={f.key}
                            />
                        </div>
                    )
                })}
            </div>
            <div className="grid md:grid-cols-2 gap-x-8 gap-y-4 w-full mt-8 p-4 bg-zinc-100 rounded-lg">
                {ARCHIVE_FIELDS.map(f => {
                    return (
                        <div
                            key={f.key}
                        >
                            <div className='text-zinc-600'>{f.caption}</div>
                            <input
                                type={f.type == 'string' ? 'text' : 'tel'}
                                className={`${focus == f.key ? 'bg-white' : 'bg-white'} w-full transition`}
                                onFocus={setFocus.bind(null, f.key)}
                                onBlur={setFocus.bind(null, null)}
                                value={extractVal(f.key)}
                                onChange={inputChanged}
                                data-key={f.key}
                            />
                        </div>
                    )
                })}
            </div>
            <div className="flex justify-center gap-2 mt-8">
                <NavLink href={`/location/${locs[idx].locationId}`}>
                    <button>Cancel</button>
                </NavLink>
                <LoadBtn
                    caption={`Save ${locs.length} ${pluralize('year', locs.length)}`}
                    onClick={saveClicked}
                />
            </div>
        </main>
    </>;
}

interface IProps {
    locs: ILocation[];
}

export default Page;