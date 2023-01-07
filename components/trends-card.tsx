import { useState, useEffect, useRef } from 'react';
import { SplitCard } from './split-card';
import { XYPlot, XAxis, YAxis, LineSeries, LineMarkSeries, LabelSeries, Hint } from 'react-vis';
import { IBiz, Metric, IIndustryInfo, humanizeMetric, abbreviateNum, getTimestampFromYear, ISeriesPoint, COLORS, INAICS } from '../utils/wsi';
import '../node_modules/react-vis/dist/style.css'; 

export function TrendsCard(props: IProps) {
    return (
        <SplitCard borderColor={props.isFlashingChart ? 'primary' : 'zinc-200'} id='trends'>
            <SplitCard.Header>
                <div className="flex flex-col md:flex-row justify-between md:items-center mx-6 my-5">
                    <h1 className="text-2xl font-light">Trends</h1>
                </div>
            </SplitCard.Header>
            <SplitCard.Body>
                <div className="flex flex-wrap p-5">
                    {(['trir', 'dart', 'total_incidents'] as Metric[]).map((k) => (
                        <button
                            key={k}
                            className={`${k == props.metric ? '_primary' : 'bg-zinc-200'} m-1`}
                            onClick={props.setChartMetricFcn.bind(null, k as ChartMetric)}
                        >
                            {humanizeMetric(k as Metric)}
                        </button>
                    ))}
                </div>
                <div className="px-2 pb-8">
                    <Chart {...props} />
                </div>
            </SplitCard.Body>
        </SplitCard>
    );
}

function Chart(props: IChartProps) {
    const [chartWidth, setChartWidth] = useState(450);
    const [windowWidth, setWindowWidth] = useState(typeof window != 'undefined' ? window.innerWidth : 0);
    useEffect(() => {
        if (typeof window != 'undefined') {
            window.addEventListener('resize', () => {
                setWindowWidth(window.innerWidth);
            });
        }
    }, []);
    const cardBodyRef = useRef<HTMLDivElement>();
    useEffect(() => {
        if (cardBodyRef.current) {
            setChartWidth(cardBodyRef.current.clientWidth);
        }
    }, [cardBodyRef.current, typeof window != 'undefined' ? window.innerWidth : 0]);

    const [points, setPoints] = useState([] as ISeriesPoint[]);
    const [yMax, setYMax] = useState(0);
    useEffect(() => {
        let curPoints: ISeriesPoint[] = [];

        props.businesses.forEach((p, idx) => {
            curPoints.push({
                x: getTimestampFromYear(p.year_filing_for),
                y: p[props.metric]!,
                label: abbreviateNum(p[props.metric]),
                xOffset: idx == props.businesses.length - 1 ? -12 : 0, //Give the first point an xOffset so it doesn't overlap with the y-axis
                yOffset: -15,
            });
        });

        setPoints(curPoints);

        let curYMax = curPoints.reduce((prev, cur) => Math.max(cur.y, prev), 0.1);
        if ((props.metric == 'trir' || props.metric == 'dart') && props.naics?.length) {
            curYMax = props.naics.reduce((prev, cur) => Math.max(cur[props.metric as 'trir'] || 0, prev), curYMax);
        }
        setYMax(curYMax);
    }, [props.metric]);

    const [pointHovered, setPointHovered] = useState(null as ISeriesPoint | null);

    return (
        <div>
            <div className="md:px-8 lg:px-6">
                <div
                    ref={cardBodyRef as any}
                    className='relative'
                >
                    <div className={`_bg-chart-radial absolute bottom-[20px] left-[40px] right-[40px] h-[160px]`}></div>
                    <XYPlot
                        width={chartWidth}
                        height={190}
                        margin={{ left: 40, right: 40, top: 10, bottom: 20 }}
                        xType='time'
                        yDomain={[0, yMax]}
                    >
                        <XAxis
                            tickValues={points.map(p => p.x)}
                            tickSize={0}
                            style={{
                                line: { stroke: COLORS.zinc500, strokeWidth: '1px' },
                                text: { fill: COLORS.zinc500 },
                            }}
                        />
                        <YAxis
                            tickFormat={v => abbreviateNum(v, true)}
                            tickSize={0}
                            style={{
                                line: { stroke: COLORS.zinc500, strokeWidth: '1px' },
                                text: { fill: COLORS.zinc500 },
                            }}
                        />
                        {props.metric != 'total_incidents' && props.naics && props.naics.filter(n => n.trir != null && n.dart != null).length == props.naics.length && (
                            <LineSeries
                                data={props.naics.map(i => ({ x: getTimestampFromYear(i.year_filing_for), y: i[props.metric as 'trir']! }))}
                                color={COLORS.secondary}
                                curve='curveMonotoneX'
                            />
                        )}
                        <LineMarkSeries
                            data={points}
                            color={COLORS.primary}
                            curve='curveMonotoneX'
                            onValueMouseOver={p => setPointHovered(p as ISeriesPoint)}
                            onValueMouseOut={setPointHovered.bind(null, null)}
                        />
                        {pointHovered != null && (
                            <Hint
                                value={pointHovered}
                                align={{
                                    vertical: 'top',
                                }}
                            >
                                <div className='px-1.5 py-0.5 bg-white text-primary rounded shadow'>
                                    {pointHovered.label}
                                </div>
                            </Hint>
                        )}
                    </XYPlot>
                </div>
            </div>

            <div className="flex flex-wrap justify-evenly mt-2 mx-auto md:mx-12 p-1 bg-white rounded">
                <div className='flex justify-center items-center w-full md:w-auto'>
                    <span className='text-primary'>{humanizeMetric(props.metric)}</span>
                    <div className="w-12 h-[3px] ml-4 bg-primary rounded-full"></div>
                </div>
                {props.metric != 'total_incidents' && (
                    <div className='flex justify-center items-center w-full md:w-auto'>
                        <span className='text-primary'>Industry avg.</span>
                        <div className="w-12 h-[3px] ml-4 bg-secondary rounded-full"></div>
                    </div>
                )}
            </div>
        </div>
    );
}

export type ChartMetric = Extract<Metric, 'trir' | 'dart' | 'total_incidents'>;

interface IProps {
    businesses: IBiz[];
    naics?: INAICS[string][];
    metric: ChartMetric;
    isFlashingChart?: boolean;
    setChartMetricFcn: (m: ChartMetric) => void;
}

interface IChartProps {
    businesses: IBiz[];
    naics?: INAICS[string][];
    metric: ChartMetric;
    isFlashingChart?: boolean;
}