// Pure URL checks behind the window navigation guard (ADR 0112). Kept free of
// Electron imports so they can be unit-tested with `npm test`.

// Only these are ever handed to the OS (shell.openExternal). Anything else —
// file:, smb:, custom app protocols — can launch local programs or reach
// network shares, and a link in a note or diagram is untrusted content.
const EXTERNAL_PROTOCOLS = new Set(['https:', 'http:', 'mailto:'])

export function isSafeExternalUrl(url: string): boolean {
  try {
    return EXTERNAL_PROTOCOLS.has(new URL(url).protocol)
  } catch {
    return false
  }
}

// True when `target` is the same page as `current`, ignoring query and hash —
// the app loads its one page with ?session= / ?path= query strings, so a reload
// or hash change must not count as leaving it. Compares protocol, host and
// pathname rather than origin because file: URLs all have the opaque origin "null".
export function isSameDocument(target: string, current: string): boolean {
  try {
    const a = new URL(target)
    const b = new URL(current)
    return a.protocol === b.protocol && a.host === b.host && a.pathname === b.pathname
  } catch {
    return false
  }
}
