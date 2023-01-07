import { PropsWithChildren, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CloseOutline, CloseCircleOutline } from "react-ionicons";
import { Loader } from "./loader";

export function Modal(props: PropsWithChildren<IProps>) {
    const ignoreClick = useRef(false);

    const [buttonsLoading, setButtonsLoading] = useState([] as IProps_Button['id'][]);
    const [buttonsErrored, setButtonsErrored] = useState([] as IProps_Button['id'][]);

    const propsRef = useRef(props);
    useEffect(() => {
        propsRef.current = props;
    }, [props]);

    const [el] = useState(() => {
        const el = document.createElement('div');
        el.className = '_modal-layer fixed flex justify-center items-center w-full h-full top-0 left-0 bg-zinc-900/25 animate-fade-in-down-0_1s z-[100]';
        
        el.addEventListener('click', () => {
            if (!ignoreClick.current && props.closeOnOutsideClick != false && props.closeFcn) {
                props.closeFcn();
            }
        });

        return el;
    });

    useEffect(() => {
        document.body.addEventListener('keyup', onBodyKeyup);
        document.body.appendChild(el);
        
        const inputEl = el.querySelector('input, textarea');
        if (inputEl) {
            (inputEl as HTMLInputElement).focus();
        }
        
        return () => {
            document.body.removeEventListener('keyup', onBodyKeyup);
            document.body.removeChild(el);
        }
    }, []);

    function onBodyKeyup(e: KeyboardEvent) {
        if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
            return;
        }

        // if (e.key == 'Escape' && props.closeFcn && !document.body.querySelector(':focus')) {
        if (e.key == 'Escape' && props.closeFcn) {
            props.closeFcn();
        } else if (e.key == 'Enter' && props.buttonClickFcn && props.buttons) {
            const defaultButton = props.buttons?.find(b => b.isDefault);
            if (defaultButton) {
                btnClick(defaultButton.id);
            }
        }
    }

    function dialogMouseUp(e: React.MouseEvent) {
        ignoreClick.current = true;
        window.setTimeout(() => {
            ignoreClick.current = false;
        }, 0);
        e.stopPropagation();
    }

    function dialogClick(e: React.MouseEvent) {
        //Stop propagation or it might bubble up to its parent, registering another click that re-opens the dialog
        e.stopPropagation();
    }

    function btnClick(id: IProps_Button['id']) {
        const button = propsRef.current.buttons?.find(b => b.id == id);
        if (button && propsRef.current?.buttonClickFcn && !button.disabled) {
            const result = propsRef.current.buttonClickFcn(button.id);

            if (result) {
                setButtonsLoading(v => {
                    if (!v.includes(button.id))  {
                        v.push(button.id);
                    }
                    return v.slice();
                });

                result
                .catch(() => {
                    setButtonsErrored(v => {
                        if (!v.includes(button.id)) {
                            v.push(button.id);
                        }
                        return v.slice();
                    });
                    window.setTimeout(() => {
                        setButtonsErrored(v => {
                            const idx = v.indexOf(button.id);
                            if (idx > -1) {
                                v.splice(idx, 1);
                            }
                            return v.slice();
                        })
                    }, 3000);
                })
                .finally(() => {
                    setButtonsLoading(v => {
                        const idx = v.indexOf(button.id);
                        if (idx > -1) {
                            v.splice(idx, 1);
                        }
                        return v.slice();
                    });
                });
            }
        }
    }

    function closeBtnClick() {
        if (props.closeFcn) {
            props.closeFcn();
        }
    }

    const content = (
        <div
            className={`${props.className || ''} relative max-w-full p-6 bg-white rounded animate-fade-in-down-0_1s shadow-2xl z-[100]`}
            style={{ width: `${props.width || 400}px` }}
            onMouseUp={dialogMouseUp}
            onClick={dialogClick}
        >
            {props.showCloseBtn != false && (
                <button
                    className="_icon _small absolute top-0 right-0 bg-white"
                    onClick={closeBtnClick}
                >
                    <CloseOutline
                        color=''
                        cssClasses='text-light'
                        width='1.75rem'
                        height='1.75rem'
                    />
                </button>
            )}
            {props.title && (
                <div className="_title mb-2">
                    <h1 className="text-3xl font-light">{props.title}</h1>
                </div>
            )}
            <div
                className={`${props.title ? '' : ''} _content`}
            >
                {props.children}
            </div>
            {props.buttons && (
                <div className="_actions flex justify-end mt-4 -mb-2">
                    {props.buttons?.map(b => (
                        <button
                            className={`${b.isDefault ? '_primary' : ''} _clear relative mx-1 first:ml-0 last:mr-0 hover:brightness-90 transition`}
                            key={b.id}
                            disabled={b.disabled || buttonsLoading.includes(b.id)}
                            onClick={btnClick.bind(null, b.id)}
                        >
                            <span
                                className={`${buttonsLoading.includes(b.id) || buttonsErrored.includes(b.id) ? 'opacity-0' : ''} transition-opacity`}
                            >
                                {b.content}
                            </span>
                            <div className="absolute flex justify-center items-center top-0 left-0 w-full h-full">
                                {buttonsLoading.includes(b.id) && (
                                    <Loader />
                                ) || buttonsErrored.includes(b.id) && (
                                    <CloseCircleOutline color='' cssClasses={`text-red-400`} width='2.5rem' height='2.5rem' />
                                )}
                            </div>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );

    return createPortal(
        content,
        el
    );
}

interface IProps {
    title?: string;
    width?: number; //Default 400(px)
    className?: string;

    buttons?: IProps_Button[];
    buttonClickFcn?: (id: IProps_Button['id']) => void | Promise<any>;
    
    closeFcn?: () => void;
    
    showCloseBtn?: boolean; //Default: true
    closeOnOutsideClick?: boolean; //Default: true
}

interface IProps_Button {
    id: string;
    content: string | JSX.Element;
    disabled?: boolean;
    isDefault?: boolean; //If this button should be styled and treated like a primary button (i.e., 'Save')
}