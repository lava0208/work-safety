import { useEffect, useRef, useState } from "react";
import { IBiz, YEARS_ARR } from "../utils/wsi";

export function YearSelector(props: IProps) {
    const [activeDataIdx, setActiveDataIdx] = useState(0);
    useEffect(() => {
        props.onChange(activeDataIdx);
    }, [activeDataIdx]);

    const yearSelector = useRef<HTMLDivElement>();
    useEffect(() => {
        if (!yearSelector.current) {
            return;
        }

        const containerRect = yearSelector.current.getBoundingClientRect();
        const selectedRect = yearSelector.current.querySelector('._primary')!.getBoundingClientRect();

        if (selectedRect.left < containerRect.left) {
            yearSelector.current.scrollTo({
                left: yearSelector.current.scrollLeft - (containerRect.left - selectedRect.left),
                behavior: 'smooth',
            });
        } else if (selectedRect.right > containerRect.right) {
            yearSelector.current.scrollTo({
                left: yearSelector.current.scrollLeft - (containerRect.right - selectedRect.right),
                behavior: 'smooth',
            });
        }
    }, [activeDataIdx]);

    return (
        <div className="flex justify-center md:gap-2">
            <div className="hidden md:block grow h-1/2 border-b-2 border-primary"></div>
            <div
                ref={yearSelector as any}
                className='flex gap-2 overflow-x-auto'
            >
                {YEARS_ARR.map((year) => (
                    <button
                        key={year}
                        className={props.businesses[activeDataIdx].year_filing_for == year ? '_primary' : ''}
                        onClick={setActiveDataIdx.bind(null, props.businesses.findIndex(c => c.year_filing_for == year))}
                        disabled={!props.businesses.some(c => c.year_filing_for == year)}
                        title={!props.businesses.some(c => c.year_filing_for == year) ? `This company didn't submit data for this year` : ''}
                    >
                        {year}
                    </button>
                ))}
            </div>
            <div className="hidden md:block grow h-1/2 border-b-2 border-primary"></div>
        </div>
    )
}

interface IProps {
    businesses: IBiz[];
    onChange: (idx: number) => void;
}