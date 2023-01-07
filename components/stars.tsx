import { StarOutline, StarHalf, Star } from "react-ionicons";

export function Stars(props: IProps) {
    let textColor = 'text-primary';
    let fillColor = 'fill-primary';
    const stars: JSX.Element[] = [];

    for (let i = 0; i <= 4; i++) {
        if (props.rating - i >= 1) {
            stars.push(
                <Star key={i} color='' width={props.size || '2rem'} height={props.size || '2rem'} cssClasses={`${textColor} ${fillColor}`} />
            );
        } else if (props.rating - i >= 0.5) {
            stars.push(
                <StarHalf key={i} color='' width={props.size || '2rem'} height={props.size || '2rem'} cssClasses={`${textColor} ${fillColor}`} />
            );
        } else {
            stars.push(
                <StarOutline key={i} color='' width={props.size || '2rem'} height={props.size || '2rem'} cssClasses={`${textColor} ${fillColor}`} />
            );
        }
    }

    return <div className="flex">{stars}</div>;
}

interface IProps {
    rating: number;
    color?: 'primary';
    size?: string; //Default 2rem
}