import { GetServerSideProps, NextPage } from 'next';
import Head from 'next/head';
import { isAdmin } from './api/login';
import { NavLink } from '../components/nav-link';

export const getServerSideProps: GetServerSideProps = async (context) => {
    if (!(await isAdmin(undefined, undefined, context.req.cookies))) {
        return {
            redirect: {
                destination: '/login',
                permanent: false,
            },
        };
    }

    return {
        props: {},
    };
}

const Page: NextPage = (props) => {
    return <>
        <Head>
            <title>Admin dashboard | Work Safety Index</title>
        </Head>

        <main className="max-w-screen-xl mx-auto px-4 py-8">
            <h1 className="text-2xl font-light">
                Shortcuts
            </h1>
            <div className="grid grid-cols-3 gap-4 p-4 bg-zinc-100 rounded-lg">
                <div>
                    <div className='text-center'>
                        Upload new OSHA data
                    </div>
                    <NavLink href='/upload'>
                        <button className='_primary w-full mt-2'>Upload</button>
                    </NavLink>
                </div>
                <div>
                    <div className='text-center'>
                        Adjust SafetyScore calculation
                    </div>
                    <NavLink href='/score-editor'>
                        <button className='_primary w-full mt-2'>Score editor</button>
                    </NavLink>
                </div>
                <div>
                    <div className='text-center'>
                        Log out as Admin
                    </div>
                    <button
                        className='w-full mt-2 bg-zinc-200 hover:bg-zinc-300'
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
                </div>
            </div>
        </main>
    </>;
}

export default Page;