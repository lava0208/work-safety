import { ButtonHTMLAttributes, useEffect, useState } from "react";

export function SocialBtn(props: IProps) {
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
        </button>
    )
}

interface IProps {
    type?: ButtonHTMLAttributes<any>['type'];
    className: String,
    caption: string;
    disabled?: boolean;
    onClick: () => Promise<any>;
}