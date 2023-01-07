import { NavLink } from "./nav-link";
import { BusinessOutline } from "react-ionicons";
import { ILocation, abbreviateNum, pluralize } from "../utils/wsi";

export const FIELDS: (keyof ILocation)[] = ['id', 'locationId', 'city', 'state', 'establishment_name', 'annual_average_employees', 'total_incidents',];

export function LocationCard(props: IProps) {
    return (
        <NavLink
            key={props.location.id}
            href={`/location/${props.location.locationId}`}
        >
            <div
                key={props.location.id}
                className={`${props.className || ''} flex gap-3 p-2 hover:bg-zinc-200 transition rounded cursor-pointer`}
            >
                <div className="flex justify-center items-center">
                    <BusinessOutline color='' width='1.8rem' height='1.8rem' cssClasses={'text-zinc-700 fill-zinc-700'} />
                </div>
                <div className="grow flex flex-col justify-evenly">
                    <span className="text-xs text-zinc-500">{props.location.city}{props.location.state ? `, ${props.location.state}` : ''}</span>
                    <div className="-mt-0.5 leading-tight">{props.location.establishment_name}</div>
                    <div className='flex mt-0.5 text-xs text-zinc-500 font-semibold'>
                        <span>{abbreviateNum(props.location.annual_average_employees)} {pluralize('employee', props.location.annual_average_employees)}</span>
                        <span className="inline-block first:hidden w-[2px] h-[0.55rem] mx-2 mt-[4px] bg-zinc-400"></span>
                        <span>{props.location.total_incidents} {pluralize('incident', props.location.total_incidents)}</span>
                    </div>
                </div>
            </div>
        </NavLink>
    );
}

interface IProps {
    location: Pick<ILocation, 'id' | 'locationId' | 'city' | 'state' | 'establishment_name' | 'annual_average_employees' | 'total_incidents'>;
    className?: string;
}