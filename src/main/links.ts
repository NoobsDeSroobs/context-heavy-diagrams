import { dialog, ipcMain } from 'electron'
import { access, mkdir, readdir, writeFile } from 'fs/promises'
import { basename, dirname, extname, isAbsolute, join, relative } from 'path'
import { createEmptyDiagram, serializeDiagram } from '@shared/diagram'
import { openDiagramAtPath } from './diagram'

// Linked diagrams colocate in the same sibling folder as assets/details
// (ADR 0005/0006, see assetsDirFor/detailsDirFor in icons.ts/details.ts) —
// e.g. my-diagram.chd -> my-diagram/child.chd, not a nested subfolder.
function linkedDiagramDirFor(diagramPath: string): string {
  const diagramBase = basename(diagramPath, extname(diagramPath))
  return join(dirname(diagramPath), diagramBase)
}

function sanitizeFileName(label: string): string {
  const cleaned = label
    .replace(/[<>:"/\\|?*]/g, '-')
    .trim()
    .replace(/\s+/g, ' ')
  return cleaned.length > 0 ? cleaned : 'diagram'
}

async function uniqueDiagramFileName(dir: string, baseName: string): Promise<string> {
  let candidate = `${baseName}.chd`
  let n = 1
  const existing = new Set(await readdir(dir).catch(() => [] as string[]))
  while (existing.has(candidate)) {
    candidate = `${baseName}-${n}.chd`
    n += 1
  }
  return candidate
}

// A relativePath stored on a node can legitimately resolve to an absolute
// path (path.relative() falls back to absolute across Windows drives) — a
// bare path.join() would silently mangle that instead of erroring, so this
// must be checked explicitly rather than always joining.
function resolveLinkPath(diagramPath: string, relativePath: string): string {
  return isAbsolute(relativePath) ? relativePath : join(dirname(diagramPath), relativePath)
}

export function registerLinkHandlers(): void {
  ipcMain.handle('links:createNew', async (_event, diagramPath: string, label: string) => {
    const dir = linkedDiagramDirFor(diagramPath)
    await mkdir(dir, { recursive: true })
    const fileName = await uniqueDiagramFileName(dir, sanitizeFileName(label))
    const filePath = join(dir, fileName)
    await writeFile(filePath, serializeDiagram(createEmptyDiagram()), 'utf-8')
    return relative(dirname(diagramPath), filePath).split('\\').join('/')
  })

  ipcMain.handle('links:pickExisting', async (_event, diagramPath: string) => {
    const result = await dialog.showOpenDialog({
      title: 'Link to diagram',
      properties: ['openFile'],
      filters: [{ name: 'Diagram', extensions: ['chd'] }]
    })
    if (result.canceled || result.filePaths.length === 0) return null
    return relative(dirname(diagramPath), result.filePaths[0]).split('\\').join('/')
  })

  ipcMain.handle(
    'links:resolve',
    async (_event, diagramPath: string, relativePath: string) => {
      const resolvedPath = resolveLinkPath(diagramPath, relativePath)
      try {
        await access(resolvedPath)
      } catch {
        return { found: false as const, resolvedPath }
      }
      // A parse failure here (corrupt file, not actually a diagram) is
      // allowed to throw — that's a distinct "couldn't be read" case from
      // "not found", not something to silently fold into found: false.
      const diagram = await openDiagramAtPath(resolvedPath)
      return { found: true as const, path: resolvedPath, diagram }
    }
  )
}
