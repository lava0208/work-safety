import { useState, useEffect, useRef, useContext } from "react";
import { NavLink } from "./nav-link";
import { People, Globe, Location, ChevronForward, CreateOutline, FlagOutline, Construct, Business, Time, InformationCircleOutline } from "react-ionicons";
import { ILocation, ICompany, humanizeIndustry, abbreviateNum, delimitNum, resizeImg, showImagePicker, UUID, showTooltip } from "../utils/wsi";
import { Modal } from "./modal";
import * as DBClient from '../utils/db-client';
import { GlobalContext } from "../contexts/global";

export function BizHeader(props: IProps) {
    const { isAdmin } = useContext(GlobalContext);

    const biz = props.location! || props.company!;

    const scrollNav = useRef<HTMLElement>();
    const [showScrollNav, setShowScrollNav] = useState(false);
    useEffect(() => {
        let timer: number | null = null;
        const scroll = () => {
            if (timer == null && scrollNav.current) {
                const rect = scrollNav.current.getBoundingClientRect();
                if (rect.top <= 0) {
                    setShowScrollNav(true);
                } else {
                    setShowScrollNav(false);
                }

                timer = window.setTimeout(() => {
                    timer = null;
                }, 50);
            }
        };

        window.addEventListener('scroll', scroll);
        return () => {
            window.removeEventListener('scroll', scroll);
        };
    }, []);

    const [isEditing, setIsEditing] = useState(false);
    const [logoSrc, setLogoSrc] = useState(props.company?.logo?.h96 || '/logo-placeholder.png');
    const [headerSrc, setHeaderSrc] = useState(props.company?.headerImg || '/header-placeholder.png');
    
        async function imagePicker(f: 'logo' | 'header') {
        if (isEditing) {
            const dataStr = await showImagePicker();
            if (!dataStr) {
                return;
            }

            if (f == 'header') {
                setHeaderSrc(await resizeImg(dataStr, 1108, 176, 'cover'));
            } else {
                setLogoSrc(await resizeImg(dataStr, 96, 96, 'contain'));
            }
        }
    }
    
    function save() {

    }

    const [isReporting, setIsReporting] = useState(false);
    const [reportMsg, setReportMsg] = useState('');

    const reportBtnEl = (<>
        <button
            className="_icon _primary flex gap-2 justify-center"
            title='Report content error'
            onClick={setIsReporting.bind(null, true)}
        >
            <FlagOutline color='' width='1.35rem' height='1.35rem' cssClasses={'text-white fill-white'} />
            <span className="md:hidden">Report error</span>
        </button>
        {isReporting && (
            <Modal
                title="Report error"
                closeFcn={setIsReporting.bind(null, false)}
                buttonClickFcn={() => {
                    return DBClient.reportError({
                        id: UUID(),
                        date: new Date().toISOString(),
                        url: location.href,
                        msg: reportMsg,
                        userAgent: navigator.userAgent,
                        deviceW: window.innerWidth,
                        deviceH: window.innerHeight,
                    })
                    .then(() => {
                        setIsReporting(false);
                        setReportMsg('');
                        showTooltip(`Thanks! We'll have a content specialist review your feedback.`);
                    });
                }}
                buttons={[{
                    id: 'submit',
                    content: 'Submit',
                    isDefault: true,
                }]}
            >
                <div>Tell us what's wrong:</div>
                <textarea
                    className="w-full h-44 mt-2 p-2 border-2 border-primary rounded-lg outline-none"
                    value={reportMsg}
                    onChange={e => {
                        setReportMsg(e.target.value);
                    }}
                ></textarea>
            </Modal>
        )}
    </>);

    return <>
        <div className="-mt-8 lg:mt-0 -mx-4 lg:mx-0 lg:rounded-t-lg overflow-hidden border-2 border-b-0 border-zinc-200 shadow">
            {(props.company?.headerImg || isEditing) && (
                <div
                    className={`${isEditing ? 'cursor-pointer' : ''} h-44 bg-contain bg-cover`}
                    onClick={imagePicker.bind(null, 'header')}
                >
                    <div
                        className="w-full h-full bg-contain bg-cover"
                        style={{ backgroundImage: `url('${headerSrc}')` }}
                    >
                    </div>
                </div>
            )}
            <div className="flex items-center gap-4 p-4">
                {(props.company?.logo || isEditing) && (
                    <div
                        className={`${isEditing ? 'cursor-pointer' : ''} ${props.company?.headerImg ? 'lg:-mt-8' : ''} flex justify-center items-center w-14 h-14 lg:w-24 lg:h-24 p-1 lg:p-2 bg-white rounded overflow-hidden shadow`}
                        onClick={imagePicker.bind(null, 'logo')}
                    >
                        <img src={logoSrc} alt="" />
                    </div>
                )}
                <div>
                    <NavLink href={`/summary/${biz.place}`}>
                        <h1 className='-mt-1 text-2xl lg:text-3xl font-light cursor-pointer'>{props.company?.company_name}</h1>
                    </NavLink>
                </div>
            </div>
            <div className="w-full h-0.5 bg-zinc-100"></div>
            <div className='grid grid-cols-[9.5rem,_1fr] gap-2.5 px-6 py-5 text-sm'>
                <div className='flex items-center'>
                    <Construct width='1.2rem' height='1.2rem' color='' cssClasses='text-zinc-600 fill-zinc-600 inline-block align-bottom' />
                    <span className="ml-2">
                        Industry:
                    </span>
                </div>
                <div className='flex items-center'>{humanizeIndustry(biz.industry, -1)}</div>
                {(biz.annual_average_employees) && <>
                    <div className='flex items-center'>
                        <People width='1.2rem' height='1.2rem' color='' cssClasses='text-zinc-600 fill-zinc-600 inline-block align-bottom' />
                        <span className="ml-2">
                            Employees:
                        </span>
                    </div>
                    <div className='flex items-center'>{abbreviateNum(biz.annual_average_employees)}</div>
                </>}
                {biz.avg_work_week != undefined && biz.avg_work_week != 0 && <>
                    <div className='flex items-center'>
                        <Time width='1.15rem' height='1.15rem' color='' cssClasses='text-zinc-600 fill-zinc-600 inline-block align-bottom' />
                        <span className="ml-2">
                            Avg. work week:
                        </span>
                    </div>
                    <div className='flex items-center'>
                        {biz.avg_work_week} hours
                        {(biz.avg_work_week < 15 || biz.avg_work_week > 100) &&  (
                            <span className="group relative ml-1.5">
                                <InformationCircleOutline color='' width='1rem' height='1rem' cssClasses={'mt-0.5 text-zinc-400 fill-zinc-400 group-hover:text-inherit group-hover:fill-inherit cursor-pointer'} />
                                <div className="absolute hidden group-hover:block top-5 left-0 p-2 bg-white border-2 border-zinc-300 whitespace-nowrap rounded shadow-lg z-50">We believe this is a data error</div>
                            </span>
                        )}
                    </div>
                </>}
                {!props.location && <>
                    <div className='flex items-center'>
                        <Business width='1.15rem' height='1.15rem' color='' cssClasses='text-zinc-600 fill-zinc-600 inline-block align-bottom' />
                        <span className="ml-2">
                            Locations:
                        </span>
                    </div>
                    <div className='flex items-center'>{abbreviateNum(props.company!.num_locations)}</div>
                </>}
                {props.location?.city && <>
                    <div className='flex items-center'>
                        <Location width='1.2rem' height='1.2rem' color='' cssClasses='text-zinc-600 fill-zinc-600 inline-block align-bottom' />
                        <span className="ml-2">
                            Location:
                        </span>
                    </div>
                    <div className='flex items-center'>{props.location.city}{props.location.state ? `, ${props.location.state}` : ''}</div>
                </>}
                {props.company?.website && <>
                    <div className='flex items-center'>
                        <Globe width='1.2rem' height='1.2rem' color='' cssClasses='text-zinc-600 fill-zinc-600 inline-block align-bottom' />
                        <span className="ml-2">
                            Website:
                        </span>
                    </div>
                    <div className='flex items-center'>
                        <a href={`http://${props.company.website}`} target='_blank'>
                            {props.company.website}
                        </a>
                    </div>
                </>}
            </div>
            <div className='flex flex-col md:hidden gap-2 mx-4 mb-4'>
                {/* <button
                    className="w-full"
                    onClick={setIsEditing.bind(null, true)}
                >
                    Manage page
                </button> */}
                {/* <button className="_primary w-full">Write a review</button> */}
                {isAdmin && (
                    <NavLink href={`/${props.company ? 'company' : 'location'}/edit/${props.company?.place || props.location?.locationId}`}>
                        <button className="_primary flex justify-center items-center gap-2 w-full">
                            <CreateOutline color='' width='1.25rem' height='1.25rem' cssClasses={'text-white fill-white'} />
                            Edit
                        </button>
                    </NavLink>
                )}
                {reportBtnEl}
            </div>
        </div>

        {props.location && (
            <div className='flex flex-col md:flex-row justify-center md:justify-between md:items-center h-12 -mx-4 lg:mx-0 px-6 py-1 bg-zinc-100 border-2 border-t-0 border-zinc-300 border-b-primary shadow'>
                <div>
                    <NavLink href={`/summary/${props.company?.place}`}>
                        <a href={`/summary/${props.company?.place}`} className='text-zinc-900'>
                            <span>{(props.company || props.location).company_name}</span>
                        </a>
                    </NavLink>
                    <span className='mx-2'>
                        <ChevronForward color='' width='1.1rem' height='1.1rem' cssClasses={'inline text-zinc-900 fill-zinc-900'} />
                    </span>
                    <span>{props.location.establishment_name}</span>
                </div>
                <div className="hidden md:flex gap-2 -mr-2">
                    {isAdmin && (
                        <NavLink href={`/location/edit/${props.location.locationId}`}>
                            <button className="_icon _primary">
                                <CreateOutline color='' width='1.35rem' height='1.35rem' cssClasses={'text-white fill-white'} />
                            </button>
                        </NavLink>
                    )}
                    {reportBtnEl}
                </div>
            </div>
        ) || (
            <nav
                ref={scrollNav as any}
                className='sticky top-0 flex justify-between items-center -mx-4 lg:mx-0 px-4 bg-zinc-100 border-2 border-t-0 border-zinc-300 border-b-primary shadow-md z-40 overflow-x-scroll'
            >
                <div className='flex shrink-0'>
                    <div
                        className={`${showScrollNav ? 'max-w-full opacity-100' : 'max-w-0 opacity-0'} hidden md:flex items-center cursor-pointer transition-all duration-500 ease-in whitespace-nowrap overflow-hidden`}
                        onClick={() => {
                            if (typeof window != 'undefined') {
                                window.scrollTo({
                                    left: 0,
                                    top: 0,
                                    behavior: 'smooth',
                                });
                            }
                        }}
                    >
                        {props.company!.logo && (
                            <div className="flex justify-center items-center w-10 h-10 p-1 rounded overflow-hidden">
                                <img src={props.company!.logo.h96} alt="" />
                            </div>
                        )}
                        <NavLink href={`/summary/${props.company!.place}`}>
                            <h1 className='max-w-[20rem] ml-1 mr-4 text-lg text-ellipsis overflow-hidden cursor-pointer'>{props.company!.company_name}</h1>
                        </NavLink>
                    </div>
                    <NavLink href={`/summary/${props.company!.place}`}>
                        <button
                            className={`${props.tab == 'summary' ? '_primary' : ''} flex flex-col justify-center items-center h-12 mx-1 first:ml-0 last:mr-0 py-0 rounded-b-none`}
                        >
                            Summary
                        </button>
                    </NavLink>
                    {/* <NavLink href={`/reviews/${props.company!.place}`}>
                        <button className={`${props.tab == 'reviews' ? '_primary' : ''} flex flex-col justify-center items-center h-12 mx-1 first:ml-0 last:mr-0 py-0 rounded-b-none`}>
                            <span className='mt-0.5'>
                                Reviews <>{props.company!.num_reviews > 0 && `(${abbreviateNum(props.company!.num_reviews)})`}</>
                            </span>
                        </button>
                    </NavLink> */}
                    <NavLink href={`/locations/${props.company!.place}`}>
                        <button
                            className={`${props.tab == 'locations' ? '_primary' : ''} flex flex-col justify-center items-center h-12 mx-1 first:ml-0 last:mr-0 py-0 rounded-b-none`}
                        >
                            <span className='mt-0.5'>
                                Locations <>{props.company!.num_locations > 0 && `(${delimitNum(props.company!.num_locations)})`}</>
                            </span>
                        </button>
                    </NavLink>
                </div>
                <div className='hidden md:flex shrink-0 items-center gap-2'>
                    {/* {isEditing && (<>
                        <button
                            className="bg-white text-primary"
                            onClick={setIsEditing.bind(null, false)}
                        >
                            Cancel
                        </button>
                        <button
                            className="_primary"
                            onClick={save}
                        >
                            Save
                        </button>
                    </>) || (
                        <button
                            className="bg-white text-primary"
                            onClick={setIsEditing.bind(null, true)}
                        >
                            Manage page
                        </button>
                    )} */}
                    {/* <button className="_primary">Write a review</button> */}
                    {isAdmin && (
                        <NavLink href={`/company/edit/${props.company!.place}`}>
                            <button className="_icon _primary">
                                <CreateOutline color='' width='1.35rem' height='1.35rem' cssClasses={'text-white fill-white'} />
                            </button>
                        </NavLink>
                    )}
                    {reportBtnEl}
                </div>
            </nav>
        )}
    </>;
}

interface IProps {
    company?: ICompany | null;
    location?: ILocation;
    tab?: 'summary' | 'reviews' | 'locations';
}