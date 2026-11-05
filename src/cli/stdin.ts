import { readFileSync } from 'node:fs'

// `-` as a file name means standard input, read once as UTF-8: a draft can be checked or compared
// without writing it first. Throws with the system's reason if there is nothing to read.
export const STDIN = '-'
export const STDIN_LABEL = '(stdin)'

export function readStdin(): string {
  return readFileSync(0, 'utf-8')
}
