import { NextPage } from 'next';
import Head from 'next/head';
import { useEffect, useRef, useState } from 'react';
import { Score } from '../components/score';
import { abbreviateNum, delimitNum } from '../utils/wsi';

const Page: NextPage = () => {
    const scoreDiv = useRef<HTMLDivElement>();
    const [score, setScore] = useState(0);

    const numsDiv = useRef<HTMLDivElement>();
    const [numsAreAnimating, setNumsAreAnimating] = useState(false);

    const [_nums, _setNums] = useState({
        bizProfiles: 0,
        bizProfilesEnd: 200000,
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
            const scoreRect = scoreDiv.current?.getBoundingClientRect();
            if (scoreRect) {
                const midPointX = scoreRect.top + scoreRect.height / 2;
                const percentScrolled = 100 - (midPointX - window.innerHeight * 0.2) / (window.innerHeight * 0.6) * 100;
                setScore(Math.max(0, Math.min(100, Math.round(percentScrolled))));
            }

            const numsRect = numsDiv.current?.getBoundingClientRect();
            if (numsRect && numsRect.top + numsRect.height / 2 < innerHeight) {
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
            <title>About | Work Safety Index</title>
        </Head>

        <main>
            <header
                className='relative flex justify-center items-center px-4 py-24 bg-right md:bg-center bg-cover text-white'
                style={{ backgroundImage: `url('header man.jpg')` }}
            >
                <div className="absolute top-0 left-0 w-full h-full bg-primary/90 md:bg-transparent md:bg-gradient-to-r from-primary via-primary to-primary/70 z-0"></div>
                <div className="max-w-screen-lg mx-auto z-10">
                    <h1 className='text-2xl font-light'>About</h1>
                    <h1 className="text-4xl font-semibold">Work Safety Index</h1>
                    <div className="md:w-1/2 mt-8">
                        <p className='text-lg font-light'>
                            Work Safety Index is dedicated to data and transparency in occupational safety. Our mission is to make safety performance integral to an organization’s overall performance.
                        </p>
                    </div>
                </div>
            </header>
            <div className="grid md:grid-cols-2 justify-items-center gap-8 max-w-screen-lg mx-auto px-4 py-14">
                <div className='flex justify-center items-center'>
                    <img src="/about us 1.png" alt="" className='w-64' />
                </div>
                <div className='flex flex-col justify-center gap-4'>
                    <p>
                        We compile and organize publicly-available safety data, then make it freely available.
                    </p>
                    <p>
                        We are the first and only place where business, government, and non-profit safety information can be easily accessed and understood.
                    </p>
                </div>
            </div>
            <div
                ref={scoreDiv as any}
                className="bg-zinc-100"
            >
                <div className="grid md:grid-cols-2 justify-items-center gap-8 max-w-screen-lg mx-auto px-4 py-14">
                    <div className='flex flex-col gap-4'>
                        <p>
                            Our key innovation is our SafetyScore, which uses a single number to give an assessment of an organization's safety performance.
                        </p>
                        <p>
                           The SafetyScore looks at an organization's most recent history of incidents, the industry averages, the rate of change from previous years, and other factors to give the business a score of 1-100.
                        </p>
                    </div>
                    <div className='flex justify-center items-center'>
                        <Score score={score} size={7} />
                    </div>
                </div>
            </div>
            <div className="grid md:grid-cols-2 justify-items-center gap-8 max-w-screen-lg mx-auto px-4 py-14">
                <div className='flex justify-center items-center'>
                    <h1 className='text-2xl font-light'>Who benefits from accessible safety performance information?</h1>
                </div>
                <div className='flex flex-col gap-4'>
                    <div>
                        <h3 className='text-lg font-semibold'>Job seekers</h3>
                        To find the safest workplaces when looking for new jobs
                    </div>
                    <div>
                        <h3 className='text-lg font-semibold'>Employees</h3>
                        To learn how their organization is handling safety, and advocate for improvements
                    </div>
                    <div>
                        <h3 className='text-lg font-semibold'>Businesses</h3>
                        To demand safe performance from their business partners
                    </div>
                    <div>
                        <h3 className='text-lg font-semibold'>Investors</h3>
                        To ensure their investments have a bright future
                    </div>
                </div>
            </div>
            <div
                ref={numsDiv as any}
                className="bg-zinc-100"
            >
                <div className="max-w-screen-lg mx-auto px-4 py-12">
                    <h1 className="text-2xl font-light">In numbers</h1>
                    <div className="grid md:grid-cols-3 md:justify-center gap-4 mt-6">
                        <div className='flex flex-col justify-center gap-2'>
                            <h3 className="text-[3.3rem] leading-none font-semibold text-primary">{abbreviateNum(nums.current.bizProfiles)}+</h3>
                            <div className='text-xl font-medium'>business profiles</div>
                        </div>
                        <div className='flex flex-col justify-center gap-2'>
                            <h3 className="text-[3.3rem] leading-none font-semibold text-primary">{abbreviateNum(nums.current.locProfiles)}+</h3>
                            <div className='text-xl font-medium'>location profiles</div>
                        </div>
                        <div className='flex flex-col justify-center gap-2'>
                            <h3 className="text-[3.3rem] leading-none font-semibold text-primary">{abbreviateNum(nums.current.dataPoints)}+</h3>
                            <div className='text-xl font-medium'>safety data points</div>
                        </div>
                    </div>
                    <div className="mt-10">
                        WIth millions of data points on organizations and their regional facilities, we have one of the most comprehensive records of occupational safety performance data available today.
                    </div>
                </div>
            </div>
        </main>
    </>;
}

export default Page;