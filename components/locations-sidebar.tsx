import { LocationCard } from "./location-card";
import { useEffect, useState } from "react";
import * as DBClient from '../utils/db-client';
import { ILocation, IBiz } from "../utils/wsi";
import { NavLink } from "./nav-link";

export function LocationsSidebar(props: IProps) {
    const [locations, setLocations] = useState(null as ILocation[] | null);
    const [locationsFilter, setLocationsFilter] = useState('');
    useEffect(() => {
        let timer: number | null = window.setTimeout(() => {
            timer = null;
            DBClient.getLocations({ relatedTo: props.relatedTo, search: locationsFilter || undefined, limit: 4 })
                .then(setLocations)
                .catch(setLocations.bind(null, []));
        }, 300);

        return () => {
            if (timer != null) {
                window.clearTimeout(timer);
            }
        }
    }, [locationsFilter, props.relatedTo]);

    useEffect(() => {
        setLocations(null); //Runs immediately
    }, [props.relatedTo]);

    return (
        <div className={`${locations == null ? 'animate-pulse' : ''}`}>
            {locations && (<>
                <div className="p-2 bg-zinc-100 rounded-lg">
                    {(locations.length > 0 || locationsFilter) && (<>
                        <div className="flex">
                            <input
                                type="text"
                                className='w-full'
                                placeholder='Filter locations'
                                onChange={e => {
                                    setLocationsFilter(e.target.value);
                                }}
                            />
                        </div>
                        <div className="mt-2">
                            {locations.map(l => (
                                <LocationCard location={l} key={l.id} />
                            ))}
                        </div>
                        <NavLink href={`/locations/${props.relatedTo.place}`}>
                            <button className="w-full mt-2">
                                See all
                            </button>
                        </NavLink>
                    </>) || (<>
                        <div className="p-2 text-zinc-400">
                            {(props.relatedTo as ILocation).parent != null
                            && `We didn't find any other locations for this business`
                            || `We didn't find any locations for this business`
                            }
                        </div>
                    </>)}
                </div>
            </>) || (<>
                <div className="flex my-2 p-2 bg-zinc-100 rounded-lg">
                    <div className="w-14 h-14 bg-zinc-200/50"></div>
                    <div className='grow ml-2'>
                        <div className="w-1/2 h-6 bg-zinc-200/50"></div>
                        <div className="w-1/3 h-2 mt-2 bg-zinc-200/50"></div>
                    </div>
                </div>
                <div className="flex my-2 p-2 bg-zinc-100 rounded-lg">
                    <div className="w-14 h-14 bg-zinc-200/50"></div>
                    <div className='grow ml-2'>
                        <div className="w-1/2 h-6 bg-zinc-200/50"></div>
                        <div className="w-1/3 h-2 mt-2 bg-zinc-200/50"></div>
                    </div>
                </div>
            </>)}
        </div>
    );
}

interface IProps {
    relatedTo: IBiz;
}