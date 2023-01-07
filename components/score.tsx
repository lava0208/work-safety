import { useEffect, useState } from "react";

const colors = [
    {
        score: 0,
        r: 143,
        g: 0,
        b: 0,
    },
    {
        score: 25,
        r: 190,
        g: 10,
        b: 10,
    },
    {
        score: 49,
        r: 215,
        g: 113,
        b: 31,
    },
    {
        score: 50,
        r: 215,
        g: 164,
        b: 0,
    },
    {
        score: 79,
        r: 255,
        g: 200,
        b: 0,
    },
    {
        score: 80,
        r: 80,
        g: 193,
        b: 91,
    },
    {
        score: 100,
        r: 0,
        g: 123,
        b: 21,
    },
];

export function Score(props: IProps) {
    const size = props.size || 4.25;

    const [score, setScore] = useState(props.animate ? 0 : props.score);
    useEffect(() => {
        if (props.animate && typeof window != 'undefined') {
            const interval = window.setTimeout(() => {
                if (score == props.score) {
                    window.clearTimeout(interval);
                    return;
                }
    
                setScore(score + 1);

                return () => {
                    window.clearTimeout(interval);
                };
            }, Math.pow(score / props.score, 15) * 180); //Easing function, essentially
        }
    }, [score]);
    useEffect(() => {
        setScore(props.score);
    }, [props.score]);

    let r = 0;
    let g = 0;
    let b = 0;
    for (let i = colors.length - 1; i >= 0; i--) {
        if (score >= colors[i].score) {
            let first = colors[i];
            let second = colors[Math.min(i + 1, colors.length - 1)];
            
            let distToSecond = first == second ? 1.0 : (score - first.score) / (second.score - first.score);
            let distToFirst = first == second ? 0.0 : 1.0 - distToSecond;

            r = Math.round(first.r * (distToFirst) + second.r * (distToSecond));
            g = Math.round(first.g * (distToFirst) + second.g * (distToSecond));
            b = Math.round(first.b * (distToFirst) + second.b * (distToSecond));
            break;
        }
    }
    
    return (
        <div
            className={`relative shrink-0 flex justify-center items-center text-white font-semibold rounded-full border-zinc-200`}
            style={{
                backgroundColor: `rgb(${r}, ${g}, ${b})`,
                width: `${size}rem`,
                height: `${size}rem`,
                fontSize: `${(size) / (props.score == 100 ? 2.25 : 1.8)}rem`,
            }}
        >
            <span className="absolute">
                {score}
            </span>
        </div>
    );
}

interface IProps {
    score: number;
    animate?: boolean;
    size?: number; //rem
}