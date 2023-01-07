export function Loader(props: IProps) {
    const size = props.size || 1.5;

    return (
        <div
            className="flex justify-between items-end p-1 pb-0.5 bg-primary"
            style={{
                width: `${size}rem`,
                height: `${size}rem`,
                padding: `${size * 0.15}rem`,
                paddingBottom: `${size * 0.125}rem`,
                borderRadius: `${size * 0.1}rem`,
            }}
        >
            <div className="order-3 h-1/2 bg-white animate-[stretch50_1.35s_0s_infinite]" style={{ width: `${size * 0.14}rem`, }}></div>
            <div className="order-2 h-3/4 bg-white animate-[stretch75_1.35s_0.1s_infinite]" style={{ width: `${size * 0.14}rem`, }}></div>
            <div className="order-1 h-1/2 bg-white animate-[stretch50_1.35s_0.2s_infinite]" style={{ width: `${size * 0.14}rem`, }}></div>
        </div>
    )
}

interface IProps {
    size?: number; //rem
}