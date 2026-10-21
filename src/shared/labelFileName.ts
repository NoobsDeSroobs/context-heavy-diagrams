// Turns an element's label into a filesystem-safe, human-recognizable
// filename stem — used for both newly-created linked diagrams
// (src/main/links/links.ts) and detail files (src/main/details/details.ts). Previously
// each had its own near-identical sanitizer that had already drifted apart
// (one replaced forbidden chars, the other deleted them; only one had a
// length cap and a reserved-name guard); consolidated here so they can't
// drift again — see docs/known-issues.md's "duplicated-but-slightly-
// different logic is where bugs hide" precedent.

// Windows reserved device names — disallowed as a filename regardless of
// extension, case-insensitive.
const WINDOWS_RESERVED = new Set([
  'con',
  'prn',
  'aux',
  'nul',
  'com1',
  'com2',
  'com3',
  'com4',
  'com5',
  'com6',
  'com7',
  'com8',
  'com9',
  'lpt1',
  'lpt2',
  'lpt3',
  'lpt4',
  'lpt5',
  'lpt6',
  'lpt7',
  'lpt8',
  'lpt9'
])

// Filters out ASCII control characters. A plain regex character class for
// this (`\x00-\x1f`) trips this project's no-control-regex lint rule, so
// this filters by code point instead.
function stripControlChars(value: string): string {
  return Array.from(value)
    .filter((ch) => (ch.codePointAt(0) ?? 0) >= 0x20)
    .join('')
}

// Multi-line labels (ADR 0074): only the first non-empty line contributes
// to the filename — later lines are a qualifier / context, not part of the
// thing's identity, and don't belong in a filename.
export function labelToFileStem(label: string, fallback: string): string {
  const firstLine = label.split(/\r?\n/).find((line) => line.trim().length > 0) ?? ''
  const sanitized = stripControlChars(firstLine)
    // Characters Windows disallows in filenames — replaced with '-' (not
    // deleted) so word boundaries survive: "A/B" -> "A-B", not "AB".
    .replace(/[<>:"/\\|?*]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60)
    // Windows also disallows a trailing dot or space — re-checked after the
    // 60-char truncation, which can itself land on one.
    .replace(/[.\s]+$/, '')
  const slug = sanitized.length > 0 ? sanitized : fallback
  return WINDOWS_RESERVED.has(slug.toLowerCase()) ? `_${slug}` : slug
}
