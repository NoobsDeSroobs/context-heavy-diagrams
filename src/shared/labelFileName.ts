// Turns an element's label into a filesystem-safe, human-recognizable
// filename stem — used for both newly-created linked diagrams
// (src/main/links/links.ts) and notes (src/main/notes/notes.ts). Previously
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

// A stem is cut at 60 characters (readability) and at 200 UTF-8 bytes: Linux
// and macOS limit one file name to 255 bytes, and a note adds "-<uuid>.md"
// (40 bytes) to the stem.
const MAX_STEM_CHARS = 60
const MAX_STEM_BYTES = 200

function utf8Length(ch: string): number {
  const cp = ch.codePointAt(0) ?? 0
  return cp < 0x80 ? 1 : cp < 0x800 ? 2 : cp < 0x10000 ? 3 : 4
}

// Cuts on whole characters (code points), so an emoji is never split in half.
export function truncateStem(value: string): string {
  const kept: string[] = []
  let bytes = 0
  for (const ch of value) {
    bytes += utf8Length(ch)
    if (kept.length >= MAX_STEM_CHARS || bytes > MAX_STEM_BYTES) break
    kept.push(ch)
  }
  return kept.join('')
}

// Multi-line labels: only the first non-empty line contributes
// to the filename — later lines are a qualifier / context, not part of the
// thing's identity, and don't belong in a filename.
export function labelToFileStem(label: string, fallback: string): string {
  const firstLine = label.split(/\r?\n/).find((line) => line.trim().length > 0) ?? ''
  const collapsed = stripControlChars(firstLine)
    // Characters Windows disallows in filenames — replaced with '-' (not
    // deleted) so word boundaries survive: "A/B" -> "A-B", not "AB".
    .replace(/[<>:"/\\|?*]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
  // Windows also disallows a trailing dot or space — re-checked after the
  // truncation, which can itself land on one.
  const sanitized = truncateStem(collapsed).replace(/[.\s]+$/, '')
  const slug = sanitized.length > 0 ? sanitized : fallback
  return WINDOWS_RESERVED.has(slug.toLowerCase()) ? `_${slug}` : slug
}

// "<stem><extension>", or "<stem>-1<extension>", "<stem>-2<extension>"... for
// the first name `isTaken` does not report. Callers compare names ignoring
// case: macOS and Windows treat "Foo.chd" and "foo.chd" as one file, and a
// folder moves between systems.
export function firstFreeName(
  stem: string,
  extension: string,
  isTaken: (name: string) => boolean
): string {
  let name = `${stem}${extension}`
  for (let n = 1; isTaken(name); n += 1) name = `${stem}-${n}${extension}`
  return name
}
