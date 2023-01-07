import { SplitCard } from "./split-card";
import { Calendar, Leaf, HandLeft, Flask, Ear, Fitness, StatsChart, TrendingDown, TrendingUp, Remove, HappyOutline, SadOutline } from "react-ionicons";
import { Metric, IBiz, IIndustryInfo, humanizeMetric, SCREEN, abbreviateNum } from "../utils/wsi";

export function IncidentsCard(props: IProps) {
    return (
        <SplitCard borderColor='zinc-200' id='incidents'>
            <SplitCard.Header>
                <div className="mx-6 my-5">
                    <h1 className='text-2xl font-light'>Incidents</h1>
                </div>
            </SplitCard.Header>
            <SplitCard.Body>
                <MetricRow metric='total_injuries' activeDataIdx={props.viewingIdx} setChartMetricFcn={props.metricClickedFcn} {...props} />
                <MetricRow metric='total_deaths' bottomBorder activeDataIdx={props.viewingIdx} setChartMetricFcn={props.metricClickedFcn} {...props} />
                <MetricRow metric='total_dafw_cases' activeDataIdx={props.viewingIdx} setChartMetricFcn={props.metricClickedFcn} {...props} />
                <MetricRow metric='total_djtr_cases' bottomBorder activeDataIdx={props.viewingIdx} setChartMetricFcn={props.metricClickedFcn} {...props} />
                <MetricRow metric='total_respiratory_conditions' activeDataIdx={props.viewingIdx} setChartMetricFcn={props.metricClickedFcn} {...props} />
                <MetricRow metric='total_skin_disorders' activeDataIdx={props.viewingIdx} setChartMetricFcn={props.metricClickedFcn} {...props} />
                <MetricRow metric='total_poisonings' activeDataIdx={props.viewingIdx} setChartMetricFcn={props.metricClickedFcn} {...props} />
                <MetricRow metric='total_hearing_loss' activeDataIdx={props.viewingIdx} setChartMetricFcn={props.metricClickedFcn} {...props} />
                <MetricRow metric='total_other_illnesses' bottomBorder activeDataIdx={props.viewingIdx} setChartMetricFcn={props.metricClickedFcn} {...props} />
            </SplitCard.Body>
        </SplitCard>
    );
}

function MetricRow(props: IMetricRowProps) {
    const location = props.businesses[props.activeDataIdx];
    const industryInfo = props.industryInfos ? props.industryInfos[props.activeDataIdx] : undefined;

    let caption = humanizeMetric(props.metric);
    let desc = '';
    let imgUrl: string | null = null;
    let icon: JSX.Element | null = null;
    switch (props.metric) {
        case 'total_deaths':
            imgUrl = '/deaths-zinc-700.svg';
            break;
        case 'total_injuries':
            imgUrl = '/injuries-zinc-700.svg';
            break;
        case 'total_dafw_cases':
            icon = <Calendar color='' width='1.1rem' height='1.1rem' cssClasses='text-zinc-700 fill-zinc-700' />;
            desc = '(cases)';
            break;
        case 'total_djtr_cases':
            imgUrl = '/days-zinc-700.svg';
            desc = '(cases)';
            break;
        case 'total_respiratory_conditions':
            icon = <Leaf color='' width='1.1rem' height='1.1rem' cssClasses='text-zinc-700 fill-zinc-700' />;
            break;
        case 'total_skin_disorders':
            icon = <HandLeft color='' width='1.1rem' height='1.1rem' cssClasses='text-zinc-700 fill-zinc-700' />;
            break;
        case 'total_poisonings':
            icon = <Flask color='' width='1.1rem' height='1.1rem' cssClasses='text-zinc-700 fill-zinc-700' />;
            break;
        case 'total_hearing_loss':
            icon = <Ear color='' width='1.1rem' height='1.1rem' cssClasses='text-zinc-700 fill-zinc-700' />;
            break;
        case 'total_other_illnesses':
            icon = <Fitness color='' width='1.1rem' height='1.1rem' cssClasses='text-zinc-700 fill-zinc-700' />;
            break;
    }

    return (
        <div className={`${props.bottomBorder ? '' : 'md:border-b-0'} group flex flex-wrap items-center px-5 py-2 hover:bg-zinc-200 border-b-2 last:border-b-0 border-zinc-200 transition`}>
            <div className="flex items-center w-full md:w-auto">
                <div className="flex justify-center items-center w-4 h-4">
                    {imgUrl && (
                        <img src={imgUrl} alt="Icon" className={props.metric == 'total_deaths' ? 'w-3' : 'w-4'} />
                    )}
                    {icon}
                </div>
                <span className={`ml-4`}>{caption}</span>
            </div>
            <div className='grow w-full md:w-auto md:mx-2 text-zinc-400 group-hover:text-zinc-900 transition'>
                {desc}
            </div>
            <div className='flex items-center'>
                <span>{abbreviateNum(location[props.metric])}</span>
                <InlineSymbols biz={location} industryInfo={industryInfo} metric={props.metric} setChartMetricFcn={props.setChartMetricFcn} />
            </div>
        </div>
    );
}

function InlineSymbols(props: IInlineSymbolsProps) {
    const els: JSX.Element[] = [];

    if (props.biz.past_averages) {
        if (props.biz[props.metric] < props.biz.past_averages[props.metric]) {
            els.push(
                <TrendingDown
                    key={`trend_${props.metric}`}
                    color=''
                    width='1.25rem'
                    height='1.25rem'
                    cssClasses='ml-4 text-zinc-500 group-hover:text-green-700 opacity-50 group-hover:opacity-100 transition-opacity'
                    title='Trending down'
                />
            );
        } else if (props.biz[props.metric] > props.biz.past_averages[props.metric]) {
            els.push(
                <TrendingUp
                    key={`trend_${props.metric}`}
                    color=''
                    width='1.25rem'
                    height='1.25rem'
                    cssClasses='ml-4 text-zinc-500 group-hover:text-red-700 opacity-50 group-hover:opacity-100 transition-opacity'
                    title='Trending up'
                />
            );
        } else {
            els.push(
                <Remove
                    key={`trend_${props.metric}`}
                    color=''
                    width='1.25rem'
                    height='1.25rem'
                    cssClasses='ml-4 text-zinc-500 opacity-50 group-hover:opacity-100 transition-opacity'
                    title='Similar to past years'
                />
            );
        }
    } else {
        els.push(
            <div key='trend_spacer' className='w-[1.25rem] ml-4'></div> //Spacer
        );
    }

    // if (props.industryInfo) {
    //     if (props.biz[props.metric] < props.industryInfo.averages[props.metric]) {
    //         els.push(
    //             <HappyOutline
    //                 key={`comp_${props.metric}`}
    //                 color=''
    //                 width='1.25rem'
    //                 height='1.25rem'
    //                 cssClasses='ml-4 text-zinc-500 fill-zinc-500 group-hover:text-green-700 group-hover:fill-green-700 opacity-50 group-hover:opacity-100 transition-opacity'
    //                 title='Better than industry average'
    //             />
    //         );
    //     } else if (props.biz[props.metric] > props.industryInfo.averages[props.metric]) {
    //         els.push(
    //             <SadOutline
    //                 key={`comp_${props.metric}`}
    //                 color=''
    //                 width='1.25rem'
    //                 height='1.25rem'
    //                 cssClasses='ml-4 text-zinc-500 fill-zinc-500 group-hover:text-red-700 group-hover:fill-red-700 opacity-50 group-hover:opacity-100 transition-opacity'
    //                 title='Worse than industry average'
    //             />
    //         );
    //     } else {
    //         els.push(
    //             <img
    //                 key={`comp_${props.metric}`}
    //                 src='/frown.svg'
    //                 className='h-[1.2rem] ml-4 opacity-25 group-hover:opacity-70 transition-opacity'
    //                 title='Similar to industry average'
    //             />
    //         );
    //     }
    // } else {
    //     els.push(
    //         <div key='comp_spacer' className='w-[1.25rem] ml-4'></div>
    //     );
    // }

    return (
        <a
            href={typeof window != 'undefined' && window.innerWidth <= SCREEN.sm ? '#incidents' : '#incidents'}
            className='flex'
            onClick={props.setChartMetricFcn?.bind(null, props.metric)}
        >
            {els}
        </a>
    );
}

interface IProps {
    viewingIdx: number;
    businesses: IBiz[]; //[0] is the newest, [end] is the oldest
    industryInfos?: IIndustryInfo[]; //[0] is the newest, [end] is the oldest
    metricClickedFcn?: (m: Metric) => void;
}

interface IMetricRowProps {
    businesses: IBiz[];
    industryInfos?: IIndustryInfo[];
    activeDataIdx: number; //Which of the locations/industryInfos we want to view
    metric: Metric;
    bottomBorder?: boolean; //Default: false
    setChartMetricFcn?: (m: Metric) => void;
}

interface IInlineSymbolsProps {
    biz: IBiz;
    industryInfo?: IIndustryInfo;
    metric: Metric;
    setChartMetricFcn?: (m: Metric) => void;
}