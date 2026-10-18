// App versions as recorded in a diagram's `savedWith` field (ADR 0118).
//
// The comparison uses the whole version (major, minor and patch), never only the
// minor: a later patch release can change what a file contains just as a later
// minor can, so "newer in any part" is the only safe reading.

export type ParsedVersion = [major: number, minor: number, patch: number]

// "0.2.1" and "0.2.1-beta.3" both read as 0.2.1; anything that is not three numbers
// is "unknown" (null), and an unknown version never triggers a warning, because
// nothing can be said about it.
export function parseVersion(version: unknown): ParsedVersion | null {
  if (typeof version !== 'string') return null
  const match = version.trim().match(/^(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/)
  return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : null
}

// Negative when a < b, zero when equal, positive when a > b.
export function compareVersions(a: ParsedVersion, b: ParsedVersion): number {
  for (let i = 0; i < 3; i++) {
    if (a[i] !== b[i]) return a[i] - b[i]
  }
  return 0
}

// True only when the file was saved by a strictly newer app than this one.
// Equal, older, missing and unreadable all return false: no warning.
export function isNewerThanApp(fileVersion: unknown, appVersion: string): boolean {
  const file = parseVersion(fileVersion)
  const app = parseVersion(appVersion)
  return file !== null && app !== null && compareVersions(file, app) > 0
}

// The warning shown when a diagram was saved by a newer app. Names both versions,
// says what can go wrong, and says what to do, because the app is offline and
// cannot look up a newer release itself.
export function newerFileMessage(
  fileVersion: string,
  appVersion: string,
  projectUrl: string
): string {
  return [
    `This diagram was saved with a newer version of Context Heavy Diagrams (${fileVersion}). You are using ${appVersion}.`,
    'It may contain things this version does not understand. If you save it here, those parts can be lost.',
    `To be safe, update the app (${projectUrl}), or use Save As to keep a copy and leave the original untouched.`
  ].join('\n\n')
}

// What `savedWith` should say after this app saves a file that recorded `recorded`:
// the higher of the two. The recorded version is only replaced by a newer one, so
// saving with the same version changes nothing (no diff noise), and an older app
// saving a newer file cannot lower the marker — the file may still hold what the
// newer app wrote.
export function stampSavedWith(recorded: unknown, appVersion: string): string {
  const current = parseVersion(recorded)
  const app = parseVersion(appVersion)
  if (current === null) return appVersion
  if (app === null) return typeof recorded === 'string' ? recorded : appVersion
  return compareVersions(current, app) > 0 ? (recorded as string) : appVersion
}
