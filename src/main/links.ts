import { dialog, ipcMain } from 'electron'
import { mkdir, readdir, writeFile } from 'fs/promises'
import { basename, dirname, extname, join, relative } from 'path'
import { createEmptyDiagram, serializeDiagram } from '@shared/diagram'
import { labelToFileStem } from '@shared/labelFileName'

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
}
