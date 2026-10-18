import { isAbsolute, join, relative, sep } from 'path'

// Resolves a path stored in a diagram (a note's `details` path) against the
// diagram's folder, but only if the result is still inside that folder (ADR 0115).
// Returns null for anything that would reach outside: an absolute path, a `..`
// that climbs out, or (on Windows) a drive-relative or stream path such as
// `C:x` or `file.md:stream`.
//
// Used wherever the app WRITES, COPIES FROM or DELETES a stored path. A diagram
// file is untrusted input once people share them, and a path like
// `../../Documents/report.docx` must never be something Save copies and deletes.
// Read-only uses (showing a note, an icon, a linked diagram) deliberately still
// follow absolute and outside paths: legacy diagrams use them and a read has no
// side effect (the app makes no network requests, ADR 0113).
//
// Not handled: a symbolic link inside the folder that points outside it.
export function containedPath(baseDir: string, relativePath: string): string | null {
  if (relativePath === '' || isAbsolute(relativePath)) return null
  if (process.platform === 'win32' && relativePath.includes(':')) return null
  // A stored path may use either separator (older builds, hand edits), whichever
  // OS this runs on.
  const full = join(baseDir, ...relativePath.split(/[\\/]/))
  const back = relative(baseDir, full)
  if (back === '' || back === '..' || back.startsWith(`..${sep}`) || isAbsolute(back)) return null
  return full
}
