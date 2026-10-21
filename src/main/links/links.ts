import { app, dialog, ipcMain } from 'electron'
import { access, mkdir, readdir, writeFile } from 'fs/promises'
import { basename, dirname, extname, join, relative } from 'path'
import { createEmptyDiagram, serializeDiagram } from '@shared/diagram'
import { labelToFileStem } from '@shared/labelFileName'
import { resolveLinkPath } from './linkPaths'

// Linked diagrams colocate in the same sibling folder as assets/details
// (ADR 0005/0006, see assetsDirFor/detailsDirFor in icons.ts/details.ts) —
// e.g. my-diagram.chd -> my-diagram/child.chd, not a nested subfolder.
function linkedDiagramDirFor(diagramPath: string): string {
  const diagramBase = basename(diagramPath, extname(diagramPath))
  return join(dirname(diagramPath), diagramBase)
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

export function registerLinkHandlers(): void {
  ipcMain.handle('links:createNew', async (_event, diagramPath: string, label: string) => {
    const dir = linkedDiagramDirFor(diagramPath)
    await mkdir(dir, { recursive: true })
    const fileName = await uniqueDiagramFileName(dir, labelToFileStem(label, 'diagram'))
    const filePath = join(dir, fileName)
    // A new file records the app that created it (ADR 0118).
    const created = { ...createEmptyDiagram(), savedWith: app.getVersion() }
    await writeFile(filePath, serializeDiagram(created), 'utf-8')
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

  // Bulk existence check for the Diagnostics "missing files" section
  // (ADR 0084) — linked diagrams, custom icons, reference images and
  // details files all resolve the same way (resolveLinkPath). Same
  // resolve + fs.access as windows:openLinked, over a (deduped) list.
  // Returns one entry per input path, in input order.
  ipcMain.handle(
    'resources:checkExist',
    async (_event, diagramPath: string, relativePaths: string[]) =>
      Promise.all(
        relativePaths.map(async (relativePath) => {
          const resolvedPath = resolveLinkPath(diagramPath, relativePath)
          try {
            await access(resolvedPath)
            return { relativePath, resolvedPath, found: true as const }
          } catch {
            return { relativePath, resolvedPath, found: false as const }
          }
        })
      )
  )
}
