import { Score } from "./score";
import { ICompany_Search, abbreviateNum, SCREEN, ICompany, humanizeIndustry } from "../utils/wsi";

export function CompanyCard(props: ICardProps) {
    const link = `/summary/${props.company.place}`;

    return (
        <a
            className={`${props.highlightMode == 'all' ? 'bg-zinc-100' : 'even:bg-zinc-100/50'} ${props.spacing == 'tight' ? 'p-2' : 'p-3'} group flex items-center w-full hover:bg-zinc-200 no-underline rounded transition`}
            href={link}
            onClick={e => {
                if ((e.target as HTMLElement).classList.contains('_incidents')) {
                    e.preventDefault();
                    location.href = `${link}#incidents`;
                } else if ((e.target as HTMLElement).classList.contains('_locations')) {
                    e.preventDefault();
                    location.href = `/locations/${props.company.place}`;
                }
            }}
        >
            {!props.hideLogo && (
                <div className={`${props.spacing == 'tight' ? 'md:w-8 md:h-8 mr-3' : 'md:w-14 md:h-14 mr-4'} shrink-0 flex justify-center items-center w-10 h-10 rounded-sm overflow-hidden`}>
                    {props.company.logo != null && (
                        <img src={props.company.logo.h96} alt="Logo" />
                    )}
                </div>
            )}
            <div className={`grow flex flex-col`}>
                {!props.hideIndustry && (
                    <span
                        className='text-xs text-zinc-500'
                        title={humanizeIndustry(props.company.industry, -1)}
                    >
                        {humanizeIndustry(props.company.industry, props.spacing == 'normal' ? -1 : undefined)}
                    </span>
                )}
                <h3 className={`${props.spacing == 'tight' ? '' : 'md:text-2xl'} mt-1 text-lg leading-none text-primary`}>{props.company.company_name}</h3>
                {!props.hideMetrics && (
                    <div className='mt-1 leading-none'>
                        {props.company.num_locations != null && (
                            <span className='_locations text-zinc-500 text-xs font-semibold hover:underline'>{abbreviateNum(props.company.num_locations)} location{props.company.num_locations > 1 ? 's' : ''}</span>
                        )}

                        <span className="inline-block first:hidden w-[2px] h-[0.55rem] mx-2 mt-[3px] bg-zinc-400"></span>
                        
                        {props.company.annual_average_employees != null && (<>
                            <span className='text-zinc-500 text-xs font-semibold'>{abbreviateNum(props.company.annual_average_employees)} employees</span>
                        </>)}
                        
                        {props.spacing == 'normal' && (<>
                            <span className="inline-block first:hidden w-[2px] h-[0.55rem] mx-2 mt-[3px] bg-zinc-400"></span>
                            
                            {props.company.total_incidents != null && (<>
                                <span className='_incidents text-zinc-500 text-xs font-semibold hover:underline'>{abbreviateNum(props.company.total_incidents)} incidents</span>
                            </>)}
                        </>)}
                    </div>
                )}
            </div>
            {!props.hideScore && props.company.wsi_score != null && (
                <div className={props.spacing == 'tight' ? 'ml-3' : 'ml-4'}>
                    <Score score={props.company.wsi_score!.score} size={props.spacing == 'tight' || typeof window != 'undefined' && window.innerWidth <= SCREEN.sm ? 2.75 : 3.75} />
                </div>
            )}
        </a>
    )
}

interface ICardProps {
    company: ICompany_Search;

    spacing: 'normal' | 'tight';
    highlightMode?: 'even' | 'all'; //Default: 'even'

    hideLogo?: boolean;
    hideIndustry?: boolean;
    hideScore?: boolean;
    hideMetrics?: boolean;
}

export const RequiredFields: (keyof ICompany)[] = ['id', 'place', 'year_filing_for', 'logo', 'industry', 'company_name', 'annual_average_employees', 'total_incidents', 'wsi_score'];