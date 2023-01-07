import React, { useEffect, useState } from 'react';
import type { AppProps } from 'next/app';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { NavLink } from '../components/nav-link';
import { Search } from 'react-ionicons';
import { SearchBar } from '../components/search-bar';
import '../styles/globals.css';
import '../styles/safety.css';
import { GlobalContext } from '../contexts/global';
import { Modal } from "../components/modal";
import { SessionProvider, useSession, signIn, signOut } from "next-auth/react"
import { NextComponentType, NextPageContext } from 'next/types';

function App({ Component, pageProps }: { Component: NextComponentType<NextPageContext, any, any>; pageProps: {}; }) {
    const router = useRouter();

    const [isSearchVisible, setIsSearchVisible] = useState(false);
    useEffect(() => {
        setIsSearchVisible(router.pathname != '/');
    }, [router.pathname]);

    const [isNavExpanded, setIsNavExpanded] = useState(false);
    useEffect(() => {
        setIsNavExpanded(false);
    }, [router.pathname]);

    const [isAdmin, setIsAdmin] = useState(false);
    useEffect(() => {
        if (typeof window != 'undefined' && window.location.pathname != '/login') {
            fetch('/api/login').then(res => {
                setIsAdmin(res.ok);
            });
        }
    }, []);

    const [timesSearchFocused, setTimesSearchFocused] = useState(0);
    const [isAuthVisible, setIsAuthVisible] = useState(false);

    const { data: session, status } = useSession()

    const handleSocialSignIn = (url: string | URL | undefined, title: string | undefined) => {
        const dualScreenLeft = window.screenLeft ?? window.screenX;
        const dualScreenTop = window.screenTop ?? window.screenY;

        const width =
            window.innerWidth ?? document.documentElement.clientWidth ?? screen.width;

        const height =
            window.innerHeight ??
            document.documentElement.clientHeight ??
            screen.height;

        const systemZoom = width / window.screen.availWidth;

        const left = (width - 500) / 2 / systemZoom + dualScreenLeft;
        const top = (height - 550) / 2 / systemZoom + dualScreenTop;

        const newWindow = window.open(
            url,
            title,
            `width=${500 / systemZoom},height=${550 / systemZoom
            },top=${top},left=${left}`
        );

        newWindow?.focus();
        if (newWindow) {
            newWindow.onbeforeunload = function(){
                router.push({ pathname: '/profile'});
            }
        }
    };

    return (
        <GlobalContext.Provider value={{
            isAdmin,
        }}>
            <div className='flex flex-col min-h-screen bg-white text-zinc-800 text-base antialiased fill-zinc-900'>
                <Head>
                    <title>Work Safety Index | Build business relationships that last</title>
                    <meta property="og:title" content="Work Safety Index" />
                    <meta
                        name="description"
                        key="desc"
                        content="Explore Work Safety Index. We provide verified safety statistics to help you build business relationships that last."
                    />
                    <meta
                        property="og:description"
                        content="Verified safety statistics to help you build business relationships that last"
                    />
                    <meta
                        property="og:image"
                        content="/cover.png"
                    />

                    <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
                    <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
                    <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
                    <link rel="manifest" href="/site.webmanifest" />
                </Head>

                <nav
                    className={`${isNavExpanded ? 'h-screen fixed transition-all' : 'h-12'} sticky md:static top-0 grid grid-cols-1 content-start gap-4 md:flex md:items-center md:h-12 w-full bg-primary shadow-[0_2px_8px_rgba(0,_0,_0,_0.4)] z-50`}
                >
                    <div className={`flex items-center justify-between md:justify-start w-full h-12 md:w-[calc(50%_-_170px)] px-4 cursor-pointer shadow-xl md:shadow-none`}>
                        {router.pathname != '/' && (
                            <div
                                className="md:hidden p-2 -ml-2"
                                onClick={e => {
                                    if (!isNavExpanded) {
                                        setIsNavExpanded(true);
                                        setTimesSearchFocused(timesSearchFocused + 1);
                                    } else {
                                        setIsNavExpanded(false);
                                    }
                                }}
                            >
                                <Search color='' width='1.6rem' height='1.6rem' cssClasses={'text-white fill-white'} />
                            </div>
                        )}
                        <div className="grow flex justify-center md:justify-start">
                            <NavLink href='/'>
                                <div className='flex gap-3 justify-center'>
                                    <img src='/wsi white.svg' className='w-12 lg:w-16' />
                                    <img src='/name.svg' className='hidden md:block w-[8.5rem] lg:w-[13rem] mt-1' />
                                </div>
                            </NavLink>
                        </div>
                        <div className="flex md:hidden">
                            <button
                                className="flex flex-col justify-center h-9 -mr-3 px-3 py-2 bg-primary hover:bg-primary hover:brightness-75  border-zinc-100"
                                onClick={setIsNavExpanded.bind(null, !isNavExpanded)}
                            >
                                <div className="w-8 h-[2px] my-[2px] bg-zinc-100"></div>
                                <div className="w-8 h-[2px] my-[2px] bg-zinc-100"></div>
                                <div className="w-8 h-[2px] my-[2px] bg-zinc-100"></div>
                            </button>
                        </div>
                    </div>

                    <div
                        className={`${isNavExpanded && isSearchVisible ? 'block' : 'hidden'} md:block w-full md:w-[340px] h-9 px-4 md:px-0`}
                    >
                        {isSearchVisible && (
                            <SearchBar
                                onSelect={place => {
                                    setIsNavExpanded(false);
                                    router.push(`/summary/${place}`);
                                }}
                                timesFocused={timesSearchFocused}
                            />
                        )}
                    </div>

                    <div className={`${isNavExpanded ? 'flex' : 'hidden'} md:flex flex-col md:flex-row justify-end items-stretch md:items-center gap-5 w-full md:w-[calc(50%_-_170px)] px-4`}>
                        <NavLink href='/'>
                            <span className="text-white text-center">
                                Home
                            </span>
                        </NavLink>
                        <NavLink href='/about'>
                            <span className="text-white text-center">
                                About
                            </span>
                        </NavLink>
                        <NavLink href='/contact'>
                            <span className="text-white text-center">
                                Contact
                            </span>
                        </NavLink>
                        
                        {status !== "authenticated" ? (
                            <span className="cursor-pointer text-white text-center" onClick={setIsAuthVisible.bind(null, true)}>
                                Sign In
                            </span>
                        ) : (
                            <span className="cursor-pointer text-white text-center" onClick={() => signOut()}>Sign out</span>
                        )}
                        {isAdmin && (
                            <button
                                className='w-full md:w-auto'
                                onClick={() => {
                                    fetch('/api/logout', { method: 'POST' }).then(() => {
                                        if (typeof window != 'undefined') {
                                            window.location.pathname = '/';
                                        }
                                    })
                                }}
                            >
                                Logout
                            </button>
                        )}
                        {isAuthVisible && status !== "authenticated" &&(
                            <Modal
                                className='custom-modal'
                                title="Create an Account or Sign In."
                                closeFcn={setIsAuthVisible.bind(null, false)}
                                buttons={[{
                                    id: 'submit',
                                    content: 'Submit',
                                    isDefault: true,
                                }]}
                            >
                                <small className='block text-center'>By continuing, you agree to our <NavLink href='/about'>Terms of Use</NavLink> and <NavLink href='/about'>Privacy Policy</NavLink>.</small>
                                <div className='social'>
                                    <button type="button" className="google gd-btn" onClick={() => handleSocialSignIn("/google-signin", "Continue with Google")}>                                      
                                        <img src='/icon-google.svg' className='SVGInline' />
                                        <span className="label">Continue with Google</span>
                                    </button>
                                    <button type="button" className="facebookWhite gd-btn center" onClick={() => handleSocialSignIn("/facebook-signin", "Continue with Facebook")}>
                                        <img src='/icon-facebook.svg' className='SVGInline' />
                                        <span className="label">Continue with Facebook</span>
                                    </button>
                                    <button type="button" className="apple gd-btn center" onClick={() => handleSocialSignIn("/apple-signin", "Continue with Apple")}>
                                        <img src='/icon-apple.svg' className='SVGInline' />
                                        <span className="label">Continue with Apple</span>
                                    </button>
                                </div>
                            </Modal>
                        )}
                    </div>
                </nav>

                <div
                    className='grow'
                >
                    <Component {...pageProps} />
                </div>

                <footer className='bg-primary text-white'>
                    <div className="flex flex-col md:flex-row justify-between gap-4 md:gap-0 max-w-screen-xl mx-auto px-4 py-8">
                        <div className="flex items-center gap-4">
                            <NavLink href={'/'}>
                                <img src="/wsi white.svg" alt="" className="h-8 cursor-pointer" />
                            </NavLink>
                            <NavLink href={'/'}>
                                <img src="/name.svg" alt="" className="h-6 mt-1.5 cursor-pointer" />
                            </NavLink>
                        </div>
                        <div className="flex flex-wrap items-center gap-4">
                            <NavLink href='/'>
                                <span className="text-white">
                                    Home
                                </span>
                            </NavLink>
                            <NavLink href='/search?s='>
                                <span className="text-white">
                                    Search
                                </span>
                            </NavLink>
                            <NavLink href='/about'>
                                <span className="text-white">
                                    About
                                </span>
                            </NavLink>
                            <NavLink href='/contact'>
                                <span className="text-white">
                                    Contact
                                </span>
                            </NavLink>
                            <span className='w-full md:w-auto md:pl-4 md:border-l-2 border-white/20 text-zinc-300'>&copy; {new Date().getFullYear()} Work Safety Index</span>
                        </div>
                    </div>
                </footer>
            </div>
        </GlobalContext.Provider>
    )
}

function MyApp({ Component, pageProps }: AppProps) {

    return <>
        <SessionProvider>
            <App Component={Component} pageProps={pageProps} />
        </SessionProvider>
    </>;
}

export default MyApp