import { ipcMain } from 'electron'
import { access, mkdir, readFile, rename, writeFile } from 'fs/promises'
import { basename, dirname, extname, join, relative } from 'path'
import { labelToFileStem } from '@shared/labelFileName'
import { fileStamp } from './fileStamp'

// Detail files live in a sibling folder named after the diagram file, same
// convention as custom icons (ADR 0006) — e.g. my-diagram.chd ->
// my-diagram/details/<filename>.md.
function detailsDirFor(diagramPath: string): string {
  const diagramBase = basename(diagramPath, extname(diagramPath))
  return join(dirname(diagramPath), diagramBase, 'details')
}

// Detail filenames are built from the element's own label plus its id's
// UUID suffix (see ADR 0060) — not its type prefix ("shape"/"container"),
// which told a reader nothing about which element a file actually belonged
// to. The UUID keeps two identically- or blank-labeled elements from
// colliding; the label is what makes the file recognizable at a glance.
// Node ids are always `${prefix}-${crypto.randomUUID()}` (Canvas.tsx's
// newNodeId) — a plain UUID has no hyphen before its first segment, so
// slicing off everything up to and including the id's first hyphen always
// isolates the UUID cleanly regardless of how long the prefix word is.
// The label -> stem sanitizing (control chars, forbidden chars, length
// cap, Windows reserved names, and — ADR 0074 — first line only) is shared
// with linked-diagram naming: labelToFileStem in @shared/labelFileName.
function detailFileName(nodeId: string, label: string): string {
  const uuid = nodeId.slice(nodeId.indexOf('-') + 1)
  return `${labelToFileStem(label, 'untitled')}-${uuid}.md`
}

export function registerDetailsHandlers(): void {
  ipcMain.handle('details:read', async (_event, diagramPath: string, relativePath: string) => {
    try {
      return await readFile(join(dirname(diagramPath), relativePath), 'utf-8')
    } catch {
      return ''
    }
  })

  // Fingerprint of a detail file (see fileStamp.ts) — the renderer records it
  // when it reads a note into a draft and compares before flushing that draft
  // back, so an outside edit to the .md isn't silently overwritten.
  ipcMain.handle('details:stat', (_event, diagramPath: string, relativePath: string) =>
    fileStamp(join(dirname(diagramPath), relativePath))
  )

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
