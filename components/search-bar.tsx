import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import { Close, CloseOutline } from 'react-ionicons';
import { Score } from '../components/score';
import { getUrlParam, humanizeIndustry, ICompany, ICompany_Search } from '../utils/wsi';
import * as DBClient from '../utils/db-client';

const RECENT_SEARCH_KEY = 'wsi-recent-searches';

export function SearchBar(props: IProps) {
    const router = useRouter();
    const { s } = router.query;

    const [isShowingSearchDropdown, setIsShowingSearchDropdown] = useState(false);
    const [softSelectIdx, setSoftSelectIdx] = useState(null as number | null);
    const [searchParam, setSearchParam] = useState((s || '') as string);

    const searchInputRef = useRef<HTMLInputElement>();
    const [curSearchInputVal, setCurSearchInputVal] = useState((s || '') as string);

    const [searchResults, setSearchResults] = useState([] as IPreResult[]);

    useEffect(() => {
        if (curSearchInputVal && softSelectIdx == null && searchInputRef.current == document.activeElement) { //Only search if input is focused
            let timer: number | null = window.setTimeout(() => {
                DBClient.search({ search: curSearchInputVal, mode: 'search', omit: props.omit, limit: 5 })
                    .then(s => {
                        if (timer != null) {
                            setSearchResults(s.results.map(r => {
                                return {
                                    type: 'company',
                                    place: r.place,
                                    caption: r.company_name,
                                    industry: humanizeIndustry(r.industry),
                                    score: r.wsi_score?.score,
                                    logo: r.logo,
                                };
                            }));
                        }
                    });
            }, 300);

            return () => { //If curSearchInputVal changes before the timeout expires, clear timeout. This achieves a debounce.
                window.clearTimeout(timer as number);
                timer = null;
            }
        } else if (isShowingSearchDropdown && !curSearchInputVal && props.hideRecent != true) {
            setSearchResults(JSON.parse(window.localStorage.getItem(RECENT_SEARCH_KEY) || '[]').map((r: string) => {
                return {
                    type: 'recent',
                    caption: r,
                } as IPreResult;
            }));
        }
    }, [curSearchInputVal, isShowingSearchDropdown]);

    useEffect(() => {
        if (searchParam != getUrlParam('s')) {
            if (searchParam && typeof window != 'undefined') {
                let recent = JSON.parse(window.localStorage.getItem(RECENT_SEARCH_KEY) || '[]') as string[];
                if (!recent.includes(curSearchInputVal)) {
                    recent.unshift(curSearchInputVal);
                    recent = recent.slice(0, 4);
                }
                window.localStorage.setItem(RECENT_SEARCH_KEY, JSON.stringify(recent));
            }

            const url = new URL('/search', window.location.origin);
            url.searchParams.set('s', searchParam);
            window.location.href = url.toString();
        }
    }, [searchParam]);

    useEffect(() => {
        if (typeof window != 'undefined') {
            const documentKeydown = (e: KeyboardEvent) => {
                if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
                    return;
                }

                switch (e.key) {
                    case '/':
                    case '?':
                    case 'F':
                    case 'f':
                        if (searchInputRef.current) {
                            searchInputRef.current.focus();
                        }
                        e.preventDefault();
                        break;
                }
            };

            document.addEventListener('keydown', documentKeydown);
            return () => {
                document.removeEventListener('keydown', documentKeydown);
            };
        }
    }, []);

    function searchKeydown(e: React.KeyboardEvent) {
        setSoftSelectIdx(null);

        if (e.key == 'Enter') {
            if (softSelectIdx != null) {
                if (searchResults[softSelectIdx].type == 'company') {
                    setIsShowingSearchDropdown(false);
                    props.onSelect(searchResults[softSelectIdx].place);
                    
                    if (props.clearOnSelect) {
                        setCurSearchInputVal('');
                        setSearchResults([]);
                    }
                } else {
                    setSearchParam(searchResults[softSelectIdx].caption);
                }
            } else {
                setIsShowingSearchDropdown(false);
                setSearchParam(curSearchInputVal);
            }
        } else if (e.key == 'Escape') {
            searchInputRef.current!.blur();
        } else if (e.key == 'ArrowUp') {
            if (searchResults.length) {
                if (softSelectIdx == null) {
                    setSoftSelectIdx(searchResults.length - 1);
                } else {
                    setSoftSelectIdx(Math.max(0, softSelectIdx - 1));
                }
                e.preventDefault();
            }
        } else if (e.key == 'ArrowDown') {
            if (searchResults.length) {
                if (softSelectIdx == null) {
                    setSoftSelectIdx(0);
                } else {
                    setSoftSelectIdx(Math.min(searchResults.length - 1, softSelectIdx + 1));
                }
                e.preventDefault();
            }
        }
    }

    useEffect(() => {
        if (props.timesFocused) {
            searchInputRef.current?.focus();
        }
    }, [props.timesFocused]);

    const results = searchResults.map((s, idx) => {
        return (
            <div
                key={s.type == 'company' ? s.place : s.caption}
                className={`${softSelectIdx == idx ? 'bg-zinc-100' : ''} flex items-center px-3 py-2 transition cursor-pointer`}
                onMouseOver={setSoftSelectIdx.bind(null, idx)}
                onMouseDown={() => {
                    if (s.type == 'recent') {
                        setCurSearchInputVal(s.caption);
                        setSearchParam(s.caption);
                    } else if (s.type == 'company') {
                        props.onSelect(s.place);

                        if (props.clearOnSelect) {
                            setCurSearchInputVal('');
                            setSearchResults([]);
                        }
                    }
                }}
            >
                {s.logo != null && (
                    <div className="flex justify-center items-center w-8 h-8">
                        <img src={s.logo.h96} alt="" />
                    </div>
                )}
                <div className='grow flex flex-col mx-2'>
                    <span className="text-sm text-zinc-500">{s.industry}</span>
                    <span className={`${s.type == 'recent' ? 'italic' : ''}`}>
                        {s.caption}
                    </span>
                </div>
                {s.score != null && (
                    <Score score={s.score} size={2.25} />
                )}
            </div>
        );
    });

    return <div className='h-full'>
        <div className="flex w-full h-full bg-white rounded">
            <input
                ref={searchInputRef as any}
                type="text"
                className="grow h-full placeholder:text-zinc-900/50 transition"
                placeholder="Search by company, industry, or EIN #"
                value={curSearchInputVal}
                onChange={e => {
                    setCurSearchInputVal(e.target.value);
                }}
                onKeyDown={searchKeydown}
                onFocus={setIsShowingSearchDropdown.bind(null, true)}
                onBlur={setIsShowingSearchDropdown.bind(null, false)}
            />
            <button
                className='_icon md:hidden ml-2 bg-white'
                onClick={() => {
                    setCurSearchInputVal('');
                    searchInputRef.current?.focus();
                }}
            >
                <CloseOutline color='' cssClasses={'text-zinc-900'} />
            </button>
        </div>
        <div className="relative w-full">
            <div className={`${isShowingSearchDropdown ? '' : 'hidden'} absolute top-full w-full mt-1 bg-zinc-50 rounded overflow-hidden shadow-xl z-50`}>
                {searchResults.length > 0 && (<>
                    {searchResults[0].type == 'recent' && (
                        <div className='flex justify-between items-center px-4 pt-2 pb-1 font-semibold'>
                            Recent
                            <button
                                className="flex justify-center items-center w-6 h-6 -mr-2 p-2 bg-transparent hover:bg-zinc-100 rounded"
                                onMouseDown={() => {
                                    if (typeof window != 'undefined') {
                                        window.localStorage.setItem(RECENT_SEARCH_KEY, '[]');
                                        setSearchResults([]);
                                        setSoftSelectIdx(null);
                                    }
                                }}
                            >
                                <Close color='' width='0.8rem' height='0.8rem' cssClasses='text-zinc-400 fill-zinc-500' />
                            </button>
                        </div>
                    )}
                    {results}
                </>)}
            </div>
        </div>
    </div>;
}

interface IProps {
    timesFocused?: number; //The number doesn't actually matter. Just needed something that could change an arbitrary number of times so we can look for a changing variable.
    onSelect: (place: ICompany['place']) => void;
    omit?: ICompany['place'][];
    
    hideRecent?: boolean;
    clearOnSelect?: boolean;
}

interface IPreResult extends Pick<ICompany_Search, 'place' | 'logo'> {
    type: 'recent' | 'company';
    caption: string;
    industry?: string;
    score?: number;
};