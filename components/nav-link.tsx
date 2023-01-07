import Link from "next/link";
import { PropsWithChildren } from "react";

/**
 * Wrapper for the NextJS <Link> component.
 * This adds an underlying <a> element, which allows users to r-clich and Open in New Tab
 */
export function NavLink(props: PropsWithChildren<IProps>) {
    return (
        <Link href={props.href}>
            <a href={props.href}>
                {props.children}
            </a>
        </Link>
    );
}

interface IProps {
    href: string;
}