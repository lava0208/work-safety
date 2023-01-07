import { ChangeEvent, useState } from 'react';
import { GetServerSideProps, NextPage } from 'next';
import Head from 'next/head';
import { NavLink } from '../../../components/nav-link';
import { LoadBtn } from '../../../components/load-btn';
import { coerceNumber, showTooltip, pluralize, ICompany, coerceString } from '../../../utils/wsi';
import * as DBServer from '../../../utils/db-server';
import * as DBClient from '../../../utils/db-client';
import { SearchBar } from '../../../components/search-bar';
import { CompanyCard } from '../../../components/company-card';
import { Close } from 'react-ionicons';
import { Loader } from '../../../components/loader';
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

    if (!context.params?.place) {
        return {
            notFound: true,
        };
    }

    return await DBServer.getCompanies({ place: context.params?.place as ICompany['place'], })
    .then(async companies => {
        if (companies?.length > 0) {
            return {
                props: {
                    companies,
                } as IProps
            };
        } else {
            return {
                notFound: true,
            };
        }
    });
}

const METADATA_FIELDS: { key: keyof (ICompany & NonNullable<ICompany['industry']>), caption: string, type: 'string' | 'number' | 'string[]' }[] = [
    { key: 'company_name', caption: 'Company name', type: 'string', },
    { key: 'naics_code', caption: 'NAICS code', type: 'number', },
    { key: 'caption', caption: 'Industry caption', type: 'string', },
    { key: 'ein', caption: 'Main EIN', type: 'string', },
    { key: 'eins', caption: 'EINs', type: 'string[]', },
];

const ALL_FIELDS: { key: keyof (ICompany & NonNullable<ICompany['industry']> & NonNullable<ICompany['archive']>), caption: string, type: 'string' | 'number' }[]
= ([] as any).concat(METADATA_FIELDS);

const Page: NextPage<IProps> = (props) => {
    const [companies, setCompanies] = useState(props.companies);
    const [idx, setIdx] = useState(0);

    const [isLoadingMergeCompany, setIsLoadingMergeCompany] = useState(false);
    const [mergingCompanies, setMergingCompanies] = useState([] as ICompany[]);

    function extractVal(key: typeof ALL_FIELDS[number]['key']) {
        switch (key) {
            case 'naics_code':
                return companies[idx].industry?.naics_code;
            case 'caption':
                return companies[idx].industry?.caption;
            case 'ein':
            case 'company_name':
                return companies[idx][key];
            case 'eins':
                if (Array.isArray(companies[idx].eins)) {
                    return companies[idx]['eins'].join(',');
                } else {
                    return companies[idx]['eins'] as any as string;
                }
        }
    }

    function inputChanged(e: ChangeEvent) {
        const key = e.target.getAttribute('data-key') as typeof ALL_FIELDS[number]['key'];
        const val = (e.target as HTMLInputElement).value;

        switch (key) {
            case 'naics_code':
                companies[idx].industry = companies[idx].industry || {};
                companies[idx].industry!.naics_code = coerceNumber(val);
                break;
            case 'caption':
                companies[idx].industry = companies[idx].industry || {};
                companies[idx].industry!.caption = val;
                break;
            case 'eins':
                companies[idx].eins = val as any;
                break;
            case 'ein':
            case 'company_name':
                if (ALL_FIELDS.find(f => f.key == key)!.type == 'number') {
                    companies[idx][key as 'total_hours_worked'] = coerceNumber(val) || 0;
                } else {
                    companies[idx][key as 'company_name'] = val;
                }
                break;
        }

        setCompanies(companies.slice());
    }

    async function saveClicked() {
        return new Promise<void>(async (resolve, reject) => {
            try {
                for (const comp of companies) {
                    for (const key of ALL_FIELDS.map(f => f.key)) {
                        switch (key) {
                            case 'naics_code':
                                comp.industry = comp.industry || {};
                                comp.industry!.naics_code = coerceNumber(comp.industry.naics_code);
                                break;
                            case 'caption':
                                comp.industry = comp.industry || {};
                                comp.industry!.caption = coerceString(comp.industry.caption);
                                break;
                            case 'eins':
                                if (!Array.isArray(comp.eins)) {
                                    comp.eins = (comp.eins as any as string).split(',').map(v => v.trim());
                                }
                                break;
                            case 'ein':
                            case 'company_name':
                                if (ALL_FIELDS.find(f => f.key == key)!.type == 'number') {
                                    comp[key as 'total_hours_worked'] = coerceNumber(comp[key]) || 0;
                                } else {
                                    comp[key as 'company_name'] = coerceString(comp[key as 'company_name'])!;
                                }
                                break;
                        }
                    }
                }

                await DBClient.editCompanies({
                    companies,
                    merge: mergingCompanies.length > 0 ? mergingCompanies : undefined
                });
    
                showTooltip('Your changes have been saved');
                location.href = `/summary/${companies[idx].place}`;
                resolve();
            } catch (ex) {
                showTooltip('Something went wrong...');
                reject();
            }
        });
    }

    return <>
        <Head>
            <title>{`Edit ${companies[idx].company_name} | Work Safety Index`}</title>
        </Head>

        <main className="flex flex-col gap-4 max-w-screen-xl mx-auto px-4 py-8">
            <div className="flex flex-col items-center gap-2">
                <h1 className='text-2xl font-light'>{companies[idx].company_name}</h1>
                <div title="Company ID" className='px-2 py-1 bg-zinc-100 border-2 border-zinc-200 italic rounded'>{companies[idx].place}</div>
            </div>

            <div className="flex justify-center gap-2 overflow-x-auto">
                {companies.map((loc, curIdx) => (
                    <button
                        key={loc.year_filing_for}
                        className={curIdx == idx ? '_primary' : ''}
                        style={{ order: companies.length - curIdx }} //Oldest left, newest right
                        onClick={setIdx.bind(null, curIdx)}
                    >
                        {loc.year_filing_for}
                    </button>
                ))}
            </div>

            <div className="grid md:grid-cols-2 gap-x-8 gap-y-4 w-full p-4 bg-zinc-100 rounded-lg">
                {METADATA_FIELDS.map(f => {
                    return (
                        <div
                            key={f.key}
                        >
                            <div className='text-zinc-600'>{f.caption}</div>
                            <input
                                type={f.type == 'number' ? 'tel' : 'text'}
                                className={`w-full transition`}
                                value={extractVal(f.key) as string}
                                onChange={inputChanged}
                                data-key={f.key}
                            />
                        </div>
                    );
                })}
            </div>

            <div>
                <h1 className='text-2xl font-light'>Companies to merge</h1>
                <div className="relative flex flex-col gap-4 p-4 bg-zinc-100 rounded-lg">
                    <SearchBar
                        hideRecent
                        clearOnSelect
                        omit={[companies[0].place].concat(mergingCompanies.map(c => c.place))}
                        onSelect={place => {
                            setIsLoadingMergeCompany(true);
                            DBClient.getCompanies({ place, limit: 1, })
                            .then(comp => {
                                setMergingCompanies(mergingCompanies.concat(comp));
                            })
                            .finally(setIsLoadingMergeCompany.bind(null, false));
                        }}
                    />
                    <>
                        {mergingCompanies.map((c, idx) => (
                            <div
                                key={c.id}
                                className='flex gap-2'
                            >
                                <button
                                    className="_icon"
                                    onClick={() => {
                                        mergingCompanies.splice(idx, 1);
                                        setMergingCompanies(mergingCompanies.slice());
                                    }}
                                >
                                    <Close />
                                </button>
                                <CompanyCard company={c} spacing='normal' />
                            </div>
                        ))}
                    </>
                    {isLoadingMergeCompany && (
                        <div className="absolute top-0 left-0 flex justify-center items-center w-full h-full bg-zinc-100/50">
                            <Loader />
                        </div>
                    )}
                </div>
            </div>

            <div className="flex justify-center gap-2 mt-8">
                <NavLink href={`/summary/${companies[idx].place}`}>
                    <button>Cancel</button>
                </NavLink>
                <LoadBtn
                    caption={`Save ${companies.length} ${pluralize('year', companies.length)}${mergingCompanies.length > 0 ? ' and merge' : ''}`}
                    onClick={saveClicked}
                />
            </div>
        </main>
    </>;
}

interface IProps {
    companies: ICompany[];
}

export default Page;