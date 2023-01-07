declare module 'fuzzy-string-matching' {
    export default function fsm(a: string, b: string, boolean?: caseSensitive): number; //Returns number (0, 1)
}