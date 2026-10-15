import { isAbsolute, resolve } from 'path'

const DIAGRAM_EXTENSION = '.chd'

// Picks the diagram files out of a process command line (ADR 0108): the OS
// hands a double-clicked file to the app as a plain argument, on a cold launch
// (process.argv) and on a second launch (the second-instance event's argv).
// Only arguments ending in .chd count — that skips the executable's own path,
// Chromium/Electron switches and anything else — and relative ones resolve
// against `workingDirectory`, which for a second launch is that process's
// directory, not ours. No existence check: a missing file is reported by the
// ordinary open flow in the window, same as any other bad path.
export function diagramPathsFromArgs(args: readonly string[], workingDirectory: string): string[] {
  const paths = args
    .filter((arg) => !arg.startsWith('-') && arg.toLowerCase().endsWith(DIAGRAM_EXTENSION))
    .map((arg) => (isAbsolute(arg) ? arg : resolve(workingDirectory, arg)))
  return [...new Set(paths)]
}
