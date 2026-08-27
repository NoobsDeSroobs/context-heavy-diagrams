import { ipcMain } from 'electron'
import { access, mkdir, readFile, rename, writeFile } from 'fs/promises'
import { basename, dirname, extname, join, relative } from 'path'

// Detail files live in a sibling folder named after the diagram file, same
// convention as custom icons (ADR 0006) — e.g. my-diagram.chd ->
// my-diagram/details/<filename>.md.
function detailsDirFor(diagramPath: string): string {
  const diagramBase = basename(diagramPath, extname(diagramPath))
  return join(dirname(diagramPath), diagramBase, 'details')
}

// Windows reserved device names — disallowed as a filename regardless of
// extension, case-insensitive. Checked against the sanitized label alone
// (before the -<uuid> suffix is appended), since that's the part a user's
// label could actually collide with.
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

// Detail filenames are built from the element's own label plus its id's
// UUID suffix (see ADR 0060) — not its type prefix ("shape"/"container"),
// which told a reader nothing about which element a file actually belonged
// to. The UUID keeps two identically- or blank-labeled elements from
// colliding; the label is what makes the file recognizable at a glance.
// Node ids are always `${prefix}-${crypto.randomUUID()}` (Canvas.tsx's
// newNodeId) — a plain UUID has no hyphen before its first segment, so
// slicing off everything up to and including the id's first hyphen always
// isolates the UUID cleanly regardless of how long the prefix word is.
// Filters out ASCII control characters — a plain regex character class for
// this (`\x00-\x1f`) trips this project's no-control-regex lint rule, so
// this filters by code point instead.
function stripControlChars(value: string): string {
  return Array.from(value)
    .filter((ch) => (ch.codePointAt(0) ?? 0) >= 0x20)
    .join('')
}

function detailFileName(nodeId: string, label: string): string {
  const uuid = nodeId.slice(nodeId.indexOf('-') + 1)
  const sanitized = stripControlChars(label)
    .trim()
    // Characters Windows disallows in filenames.
    .replace(/[<>:"/\\|?*]/g, '')
    .replace(/\s+/g, ' ')
    // Windows also disallows a trailing dot or space.
    .replace(/[.\s]+$/, '')
    .slice(0, 60)
  const slug = sanitized.length > 0 ? sanitized : 'untitled'
  const base = WINDOWS_RESERVED.has(slug.toLowerCase()) ? `_${slug}` : slug
  return `${base}-${uuid}.md`
}

export function registerDetailsHandlers(): void {
  ipcMain.handle('details:read', async (_event, diagramPath: string, relativePath: string) => {
    try {
      return await readFile(join(dirname(diagramPath), relativePath), 'utf-8')
    } catch {
      return ''
    }
  })

  ipcMain.handle(
    'details:write',
    async (_event, diagramPath: string, nodeId: string, label: string, content: string) => {
      const dir = detailsDirFor(diagramPath)
      await mkdir(dir, { recursive: true })
      const filePath = join(dir, detailFileName(nodeId, label))
      await writeFile(filePath, content, 'utf-8')
      return relative(dirname(diagramPath), filePath).split('\\').join('/')
    }
  )

  // Renames an existing detail file to match the element's current label,
  // if it's drifted out of sync — covers both a genuine relabel and a
  // one-off migration of pre-existing `<type>-<uuid>.md` files the first
  // time any given diagram is saved under the current naming convention
  // (no separate migration step needed: any name that isn't what
  // detailFileName would produce today gets brought into line here).
  // A no-op, not an error, if nothing's actually on disk yet at the old
  // path (e.g. a stale/broken reference) — the next real content write
  // will create the correctly-named file regardless.
  ipcMain.handle(
    'details:syncName',
    async (
      _event,
      diagramPath: string,
      nodeId: string,
      label: string,
      currentRelativePath: string
    ) => {
      const baseDir = dirname(diagramPath)
      const oldPath = join(baseDir, currentRelativePath)
      const newPath = join(detailsDirFor(diagramPath), detailFileName(nodeId, label))
      if (oldPath === newPath) return currentRelativePath
      try {
        await access(oldPath)
      } catch {
        return currentRelativePath
      }
      await rename(oldPath, newPath)
      return relative(baseDir, newPath).split('\\').join('/')
    }
  )
}
