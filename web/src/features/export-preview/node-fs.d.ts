// Only the Node API used by the stylesheet test; the app uses browser types.
declare module 'node:fs' {
  export function readFileSync(path: string, encoding: 'utf8'): string
}
