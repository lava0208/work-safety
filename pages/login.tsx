import type { NextPage } from 'next';
import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';

const Page: NextPage = () => {
    const [pass, setPass] = useState('');
    const [isError, setIsError] = useState(false);
    function keyDown(e: React.KeyboardEvent) {
        if (e.key == 'Enter') {
            submit();
        }
    }
    useEffect(() => {
        setIsError(false);
    }, [pass]);

    function submit() {
        fetch('/api/login', {
            method: 'POST',
            body: JSON.stringify({
                pass: pass
            }),
        })
        .then(response => {
            if (response.ok) {
                if (typeof window != 'undefined') {
                    window.location.pathname = '/admin';
                }
            } else {
                setIsError(true);
            }
        });
    }

    const [el] = useState(() => {
        let el = null;
        if (typeof window != 'undefined') {
            el = document.createElement('div');
            el.className = 'fixed flex justify-center items-center w-full h-full top-0 left-0 bg-primary z-[1001]';
        }
        return el;
    });
    useEffect(() => {
        if (el && typeof window != 'undefined') {
            document.body.appendChild(el);
            return () => {
                document.body.removeChild(el);
            }
        }
    }, []);

    const content = <>
        <div className="flex flex-col items-center p-4 bg-white rounded-lg">
            <h3 className='mb-4 text-xl font-light'>Enter password</h3>
            <input
                type='password'
                className='w-full border-2 border-zinc-200'
                onKeyDown={keyDown}
                onChange={e => { setPass(e.target.value); }}
                value={pass}
                autoFocus
            />
            {isError && (
                <div className="text-red-600">Try again</div>            
            )}
            <button
                type="submit"
                className='_primary mt-4'
                onClick={submit}
            >Enter</button>
        </div>
    </>;

    if (el && typeof window != 'undefined') {
        return createPortal(
            content,
            el
        );
    } else {
        return content;
    }
}

export default Page