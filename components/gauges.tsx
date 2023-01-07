import { IBiz, INAICS } from "../utils/wsi";

export function Gauges(props: IProps) {
    const biz = props.businesses[props.viewingIdx];
    const naics = props.naics[props.viewingIdx];

    /*
    Total scale: (-90deg, 90deg)
        -90deg = 0
        0deg = 100% of average
        90deg = 500% of average
    */

    if (naics.trir == null || naics.dart == null) {
        return null;
    }

    let trirRotation = 0;
    if (biz.trir <= naics.trir) {
        trirRotation = Math.max(0, Math.min(1, biz.trir / naics.trir)) * 90 - 90;
    } else {
        trirRotation = Math.max(0, Math.min(1, (biz.trir - naics.trir) / (4 * naics.trir))) * 90;
    }
    
    let dartRotation = 0;
    if (biz.dart <= naics.dart) {
        dartRotation = Math.max(0, Math.min(1, biz.dart / naics.dart)) * 90 - 90;
    } else {
        dartRotation = Math.max(0, Math.min(1, (biz.dart - naics.dart) / (4 * naics.dart))) * 90;
    }

    return (<>
        <div className='grid md:grid-cols-2 gap-4'>
            <div className="relative flex flex-col items-center p-7 pt-9 bg-zinc-100 rounded-lg">
                <h3 className='absolute top-4 left-4 text-xl font-light'>Incident rate</h3>
                <div className='flex flex-col items-center text-xl px-3 py-1 bg-white rounded-full'>
                    <span className='text-3xl z-10'>{biz.trir.toFixed(2)}</span>
                </div>
                <div className="_bg-rainbow relative flex justify-center items-end w-64 h-32 mt-3 bg-white">
                    <div className="_bg-gauge-mask absolute top-0 left-0 w-full h-full"></div>
                    <div
                        className="absolute bottom-0 left-1/2 w-1 h-full -ml-0.5 origin-bottom transition-all duration-500 ease-out"
                        style={{ rotate: `${trirRotation}deg` }}
                    >
                        <div className="absolute top-0 left-1/2 w-5 h-5 -ml-2.5 -mt-1 bg-white border-[3px] border-primary rounded-full shadow"></div>
                    </div>
                    <div className="absolute bottom-0 left-1/2 w-1 h-4/5 -ml-0.5">
                        <div className="absolute w-full h-1/3 top-0 bg-zinc-500"></div>
                    </div>
                    <div className="flex flex-col items-center text-zinc-500 z-10">
                        <div className='text-2xl'>
                            {naics.trir.toFixed(2)}
                        </div>
                        <div className='text-sm'>Industry avg.</div>
                    </div>
                </div>
            </div>
            <div className="relative flex flex-col items-center p-7 pt-9 bg-zinc-100 rounded-lg">
                <h3 className='absolute top-4 left-4 text-xl font-light'>DART</h3>
                <div className='flex flex-col items-center text-xl px-3 py-1 bg-white rounded-full'>
                    <span className='text-3xl z-10'>{biz.dart.toFixed(2)}</span>
                </div>
                <div className="_bg-rainbow relative flex justify-center items-end w-64 h-32 mt-3 bg-white">
                    <div className="_bg-gauge-mask absolute top-0 left-0 w-full h-full"></div>
                    <div
                        className="absolute bottom-0 left-1/2 w-1 h-full -ml-0.5 origin-bottom transition-all duration-500 ease-out"
                        style={{ rotate: `${dartRotation}deg` }}
                    >
                        <div className="absolute top-0 left-1/2 w-5 h-5 -ml-2.5 -mt-1 bg-white border-[3px] border-primary rounded-full shadow"></div>
                    </div>
                    <div className="absolute bottom-0 left-1/2 w-1 h-4/5 -ml-0.5">
                        <div className="absolute w-full h-1/3 top-0 bg-zinc-500"></div>
                    </div>
                    <div className="flex flex-col items-center text-zinc-500 z-10">
                        <div className='text-2xl'>
                            {naics.dart.toFixed(2)}
                        </div>
                        <div className='text-sm'>Industry avg.</div>
                    </div>
                </div>
            </div>
        </div>
    </>);
}

interface IProps {
    viewingIdx: number;
    businesses: IBiz[]; //[0] is the newest, [end] is the oldest
    naics: INAICS[string][];
}