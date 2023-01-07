import type { NextPage } from 'next';
import { GetServerSideProps } from 'next';
import Head from 'next/head';
import { useEffect, useState } from 'react';
import { Loader } from '../components/loader';
import { showTooltip, Payloads, sortBy } from '../utils/wsi';
import { Checkmark } from 'react-ionicons';
import * as DBClient from '../utils/db-client';
import { LoadBtn } from '../components/load-btn';
import { isAdmin } from './api/login';

export const getServerSideProps: GetServerSideProps = async (context) => {
    if (!(await isAdmin(undefined, undefined, context.req.cookies))) {
        return {
            redirect: {
                destination: '/login',
                permanent: false,
            }
        };
    }

    return {
        props: {},
    };
}

const Page: NextPage = (props) => {
    const [files, setFiles] = useState(null as FileList | null);
    const [fieldAssignments, setFieldAssignments] = useState(null as Payloads.IFieldMaps | null);
    const [numImperfectMatches, setNumImperfectMatches] = useState(0);
    const [numConfirmedFields, setNumConfirmedFields] = useState(0);
    const [skipLocations, setSkipLocations] = useState(false);

    const [preExistingFiles, setPreExistingFiles] = useState([] as string[]);
    const [selectedPreExistingFile, setSelectedPreExistingFile] = useState('');
    useEffect(() => {
        DBClient.getFileNames({ prefix: 'osha' }).then(names => {
            if (names?.length) {
                const sorted = names.sort().reverse();
                setPreExistingFiles(sorted); //Newest first
                setSelectedPreExistingFile(sorted.length ? sorted[0] : '');
            }
        });
    }, [fieldAssignments]);

    const [isUploading, setIsUploading] = useState(false);
    const [isVerifying, setIsVerifying] = useState(false);
    const [importPayload, setImportPayload] = useState(null as Payloads.IVerifyImport | null);
    useEffect(() => {
        if (importPayload?.filename) {
            setIsVerifying(true);
            DBClient.verifyImport(importPayload)
                .then(p => {
                    setNumImperfectMatches(Object.entries(p.main).filter(f => f[0] != f[1]).length + Object.entries(p.archive).filter(f => f[0] != f[1]).length);
                    setFieldAssignments(p);
                })
                .finally(setIsVerifying.bind(null, false));
        }
    }, [importPayload]);

    const [progress, setProgress] = useState(null as Payloads.IFinishImport | null);
    useEffect(() => {
        if (progress) {
            setTimeout(() => {
                DBClient.finishImport(progress).then(p => {
                    if (p) {
                        setProgress(p);
                    }
                });
            }, 5000);
        }
    }, [progress]);

    function abort() {
        setFiles(null);
        setFieldAssignments(null);
        setNumImperfectMatches(0);
        setNumConfirmedFields(0);
        setImportPayload(null);
    }

    return <>
        <Head>
            <title>Upload | Work Safety Index</title>
        </Head>

        <main className="max-w-screen-2xl mx-auto px-4 py-10">
            <h1 className='text-2xl font-light'>OSHA data</h1>
            <div className="relative p-4 bg-zinc-100 rounded-lg">
                {fieldAssignments == null && (<>
                    <div className="relative grid grid-cols-2">
                        <div>
                            <h3 className="text-lg">Upload new file</h3>
                            <form action="/api/upload" method='post' encType='multipart/form-data' id='osha-form'>
                                <div>
                                    <input
                                        type="file"
                                        name="osha-file"
                                        id="osha-file"
                                        onChange={e => {
                                            setFiles((e.target as HTMLInputElement).files);
                                        }}
                                    />
                                </div>
                                <LoadBtn
                                    type="submit"
                                    caption='Upload'
                                    disabled={!files?.length}
                                    onClick={() => {
                                        setIsUploading(true);
                                        const formData = new FormData(document.querySelector('#osha-form') as HTMLFormElement);
                                        return DBClient.uploadForm<Payloads.IVerifyImport>(formData)
                                            .then(setImportPayload)
                                            .catch(() => {
                                                showTooltip('The upload failed for some reason.');
                                            })
                                            .finally(setIsUploading.bind(null, false));
                                    }}
                                />
                                {isUploading && (
                                    <div className="mt-1 text-sm">Please be patient. Uploading can take some time.</div>
                                )}
                            </form>
                        </div>
                        <div>
                            <h3 className="text-lg">Or import an existing file</h3>
                            <select
                                className='w-full'
                                onChange={e => {
                                    setSelectedPreExistingFile(e.target.value);
                                }}
                            >
                                {preExistingFiles.map(f => (
                                    <option value={f} key={f}>{f}</option>
                                ))}
                            </select>
                            <button
                                className="_primary mt-2"
                                onClick={() => {
                                    setImportPayload({
                                        filename: selectedPreExistingFile,
                                    });
                                }}
                            >
                                Begin
                            </button>
                        </div>
                    </div>
                    {isVerifying && (
                        <div className="absolute flex justify-center items-center top-0 left-0 w-full h-full bg-zinc-100/60 rounded-lg">
                            <Loader />
                        </div>
                        )}
                </>) || progress == null && (<>
                    <div className="mt-2">
                        <span className='p-2 bg-zinc-200 border-2 border-zinc-400 rounded'>
                            {importPayload?.filename}
                        </span>
                    </div>
                    <div className='mt-4'>
                        Initial lookup finished. Found:
                        <ul className='pl-8 list-disc'>
                            <li>{Object.entries(fieldAssignments!.main).filter(f => f[0] == f[1]).length + Object.entries(fieldAssignments!.archive).filter(f => f[0] == f[1]).length} fields from your file that exactly match our data fields</li>
                            <li>{numImperfectMatches} matches needing review</li>
                            <li>{fieldAssignments!.unusedFields.length} unexpected fields</li>
                        </ul>
                    </div>
                    <div className='mt-4 border-2 border-zinc-200 rounded'>
                        <div className="grid grid-cols-[60px,_1fr,_1fr] gap-2 p-2 bg-zinc-200 rounded-sm">
                            <div className='font-semibold'>Match</div>
                            <div className='font-semibold'>Our field</div>
                            <div className='font-semibold'>From your file</div>
                        </div>
                        {Object.entries(fieldAssignments!.main).concat(Object.entries(fieldAssignments!.archive)).sort((a, b) => {
                            if (a[0] > b[0]) {
                                return 1;
                            } else if (a[0] < b[0]) {
                                return -1;
                            } else {
                                return 0;
                            }
                        }).map(f => (
                            <div
                                key={f[0]}
                                className='grid grid-cols-[60px,_1fr,_1fr] gap-2 p-2 hover:bg-zinc-200 border-b-2 border-zinc-200 last:border-b-0 transition'
                            >
                                <div className='flex items-center'>
                                    {f[0] == f[1] && (
                                        <Checkmark color='' width='1.25rem' height='1.25rem' cssClasses={'text-zinc-500 fill-zinc-500'} />
                                    ) || (
                                            <input type="checkbox" name="" id="" onChange={e => setNumConfirmedFields(numConfirmedFields + (e.target.checked ? 1 : -1))} />
                                        )}
                                </div>
                                <div>{f[0]}</div>
                                <div>{f[1]}</div>
                            </div>
                        ))}
                    </div>

                    <h2 className='mt-4 text-xl'>Unmatched fields</h2>
                    <div className='border-2 border-zinc-200 rounded'>
                        <div className="grid grid-cols-1 gap-2 p-2 bg-zinc-200 rounded-sm">
                            <div className='font-semibold'>Header</div>
                        </div>
                        {fieldAssignments!.unusedFields.length > 0 && fieldAssignments!.unusedFields.sort(sortBy('colIdx')).map(f => (<>
                            <div
                                key={f}
                                className='grid grid-cols-1 gap-2 p-2 hover:bg-zinc-200 border-b-2 border-zinc-200 last:border-b-0 transition'
                            >
                                <div>{f}</div>
                            </div>
                        </>)) || (
                                <div className='p-2'>No unmatched fields!</div>
                            )}
                    </div>

                    <h2 className='mt-4 text-xl'>Options</h2>
                    <div>
                        <div className="flex items-center gap-2">
                            <input type="checkbox" name="skipLocations" id="skipLocations" checked={skipLocations} onChange={ e => setSkipLocations(e.target.checked) } />
                            <label htmlFor="skipLocations" className='shrink-0'>Skip locations</label>
                        </div>
                        <div className='mt-1 text-xs text-zinc-500 leading-none'>This will still parse all locations in order to build company profiles, but no locations will be pushed to the DB. Useful for when a previous import finished all locations but erred on companies.</div>
                    </div>

                    <div className="mt-6">
                        <button
                            className='mr-2 bg-red-700 hover:bg-red-800 text-white'
                            onClick={abort}
                        >
                            Abort
                        </button>
                        <LoadBtn
                            caption='Start import'
                            disabled={numConfirmedFields != numImperfectMatches}
                            onClick={() => {
                                return DBClient.finishImport({
                                    filename: fieldAssignments?.filename,
                                    skipLocations,
                                }).then(setProgress);
                            }}
                        />
                    </div>
                </>) || progress != null && (<>
                    <div className='mt-2'>
                        <span className='p-2 bg-zinc-200 border-2 border-zinc-400 rounded'>
                            {importPayload?.filename}
                        </span>
                    </div>
                    <div className="flex mt-4">
                        <span className='font-semibold'>Task:</span>
                        <span className='ml-2'>{progress.task}</span>
                    </div>
                    <div className="flex">
                        <span className='font-semibold'>Progress:</span>
                        <span className='ml-2'>{`${Math.floor(progress.completedTasks! / progress.totalTasks! * 100)}%`}</span>
                    </div>
                    <div className="w-[500px] max-w-full h-10 mt-2 bg-white border-2 border-zinc-200 rounded-lg overflow-hidden">
                        <div
                            className="flex justify-center items-center w-0 h-full bg-primary transition-all duration-500"
                            style={{ width: `${Math.floor(progress.completedTasks! / progress.totalTasks! * 100)}%` }}
                        >
                        </div>
                    </div>
                    <div className="mt-2">
                        <p className='font-semibold'>Notes:</p>
                        <p>
                            Progress may slow down or move backward temporarily as new records are added to the queue.
                        </p>
                        <p>
                            Processing will continue if you navigate away from this page, but you will not be able to return to see its progress.
                        </p>
                    </div>
                </>)}
            </div>
        </main>
    </>;
}

export default Page