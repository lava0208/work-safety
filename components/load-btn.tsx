import { ButtonHTMLAttributes, useEffect, useState } from "react";
import { Loader } from "./loader";

export function LoadBtn(props: IProps) {
    const [isLoading, setIsLoading] = useState(false);
    
    const [isDisabled, setIsDisabled] = useState(false);
    useEffect(() => {
        setIsDisabled(props.disabled || false);
    }, [props.disabled]);

    return (
        <button
            type={props.type || 'button'}
            className='_primary relative overflow-hidden'
            disabled={isDisabled || isLoading}
            onClick={e => {
                e.preventDefault();
                setIsLoading(true);
                props.onClick().finally(setIsLoading.bind(null, false));
            }}
        >
            <span>{props.caption}</span>
            {isLoading && (
                <div className="absolute top-0 left-0 flex justify-center items-center w-full h-full bg-white/50 animate-[fadeIn_0.2s]">
                    <Loader />
                </div>
            )}
        </button>
    )
}

interface IProps {
    type?: ButtonHTMLAttributes<any>['type'];
    caption: string;
    disabled?: boolean;
    onClick: () => Promise<any>;
}