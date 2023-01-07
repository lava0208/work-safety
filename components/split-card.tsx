import { PropsWithChildren } from 'react';

export function SplitCard(props: PropsWithChildren<IProps>) {
    return <div id={props.id} className={`${props.borderColor == 'zinc-200' ? 'border-zinc-200' : 'border-primary'} flex flex-col border-2 rounded-lg transition-colors duration-500 ease-in-out`}>
        {props.children}
    </div>
}

SplitCard.Header = (props: PropsWithChildren<IProps>) => (
    <div className='relative bg-white rounded-t-lg'>
        {props.children}
    </div>
);

SplitCard.Body = (props: PropsWithChildren) => (
    <div className='grow bg-zinc-100 rounded-lg overflow-hidden'>
        {props.children}
    </div>
);

interface IProps {
    id?: string;
    borderColor?: 'primary' | 'zinc-200';
}