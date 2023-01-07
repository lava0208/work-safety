import { NextPage } from 'next';
import Head from 'next/head';
import { useEffect, useRef, useState } from 'react';
import { delimitNum } from '../utils/wsi';

const Page: NextPage = () => {
    const numsDiv = useRef<HTMLDivElement>();
    const [numsAreAnimating, setNumsAreAnimating] = useState(false);

    const [_nums, _setNums] = useState({
        bizProfiles: 0,
        bizProfilesEnd: 100000,
        locProfiles: 0,
        locProfilesEnd: 400000,
        dataPoints: 0,
        dataPointsEnd: 5000000,
    });
    const nums = useRef(_nums);
    function setNums(n: typeof _nums) {
        _setNums(n);
        nums.current = n;
    }

    useEffect(() => {
        function scroll() {
            const rect = numsDiv.current?.getBoundingClientRect();
            if (rect && rect.top + rect.height / 2 < innerHeight) {
                setNumsAreAnimating(true);
            }
        }

        window.addEventListener('scroll', scroll);
        return () => {
            window.removeEventListener('scroll', scroll);
        };
    }, []);

    useEffect(() => {
        if (numsAreAnimating) {
            let x = 0;

            let anim = () => {
                x = Math.min(x + 0.03, 1);
    
                setNums({
                    bizProfiles: Math.ceil(ease(x, nums.current.bizProfilesEnd)),
                    bizProfilesEnd: nums.current.bizProfilesEnd,
                    locProfiles: Math.ceil(ease(x, nums.current.locProfilesEnd)),
                    locProfilesEnd: nums.current.locProfilesEnd,
                    dataPoints: Math.ceil(ease(x, nums.current.dataPointsEnd)),
                    dataPointsEnd: nums.current.dataPointsEnd,
                });
        
                if (nums.current.bizProfiles < nums.current.bizProfilesEnd || nums.current.locProfiles < nums.current.locProfilesEnd || nums.current.dataPoints < nums.current.dataPointsEnd) {
                    setTimeout(anim, 35);
                }
            }
    
            anim();
        }
    }, [numsAreAnimating]);

    function ease(x: number, max: number): number {
        return Math.sin(x * Math.PI / 2) * max;
    }

    return <>
        <Head>
            <title>Contact | Work Safety Index</title>
        </Head>

        <main>
            <header
                className='relative flex justify-center items-center px-4 py-16 bg-right md:bg-center bg-cover text-white'
                style={{ backgroundImage: `url('header factory.jpg')` }}
            >
                <div className="absolute top-0 left-0 w-full h-full bg-primary/90 md:bg-transparent md:bg-gradient-to-r from-primary/90 via-primary/90 to-primary/70 z-0"></div>
                <div className="w-2/3 max-w-screen-lg mx-auto z-10">
                    <h1 className='text-2xl font-light'>Contact</h1>
                    <h1 className="text-4xl font-semibold">Work Safety Index</h1>
                </div>
            </header>
            <div className="bg-zinc-100">
                <div className="flex flex-col gap-8 max-w-screen-lg mx-auto px-4 py-14">
                    <div className='flex flex-col gap-4'>
                        <h3 className="font-light text-2xl">Contact</h3>
                        <div>
                            Have a question or want to engage? Reach out! We are interested in hearing from individuals and organizations. You can contact us by email at:
                        </div>
                        <div className="font-semibold">
                            <a href="mailto:info@worksafetyindex.com">
                                info@worksafetyindex.com
                            </a>
                        </div>
                    </div>
                    <div className='flex flex-col gap-4'>
                        <h3 className="font-light text-2xl">Business inquiries</h3>
                        <div>
                            WorkSafety Index is interested in partnering with businesses who align with our goal of making safety performance data publicly available. If you are interested in doing business with us, please contact our sales team:
                        </div>
                        <div className="font-semibold">
                            <a href="mailto:sales@worksafetyindex.com">
                                sales@worksafetyindex.com
                            </a>
                        </div>
                    </div>
                </div>
            </div>
            <div className="max-w-screen-lg mx-auto px-4 py-12">
                <h1 className="text-2xl font-light">Errors and glitches</h1>
                <div className="mt-2">
                    We are always striving to improve. One of the pitfalls of being a public database is it’s obvious when we make mistakes. If we made a mistake about an organization you’re familiar with, we apologize and want to make it right. Let us know about the mistake by flagging it on the organization’s profile. We’ll get it fixed in a jiffy.
                </div>
            </div>
        </main>
    </>;
}

export default Page;