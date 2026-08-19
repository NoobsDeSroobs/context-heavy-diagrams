import { dialog, ipcMain } from 'electron'
import { readFile, writeFile } from 'fs/promises'
import { parseDiagram, serializeDiagram, type DiagramFile } from '@shared/diagram'

// Diagram files are a single file (.chd, plain JSON underneath) — see
// docs/decisions/0005-diagram-identity-and-linking.md. Nothing about
// opening/saving depends on foldering at all; that's the whole point of
// this model over the folder-based one it replaced (ADR 0003).
const FILTERS = [{ name: 'Diagram', extensions: ['chd'] }]

// Shared by diagram:open (dialog-driven) and diagram:openPath / links:resolve
// (already-known absolute path, no dialog) — one place that reads+parses a
// .chd off disk.
export async function openDiagramAtPath(path: string): Promise<DiagramFile> {
  const raw = await readFile(path, 'utf-8')
  return parseDiagram(raw)
}

export function registerDiagramHandlers(): void {
  ipcMain.handle('diagram:pickSavePath', async () => {
    const result = await dialog.showSaveDialog({
      title: 'Save diagram',
      defaultPath: 'New Diagram.chd',
      filters: FILTERS
    })
    if (result.canceled || !result.filePath) return null
    return result.filePath
  })

  ipcMain.handle('diagram:save', async (_event, path: string, diagram: DiagramFile) => {
    await writeFile(path, serializeDiagram(diagram), 'utf-8')
  })

  ipcMain.handle('diagram:open', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: FILTERS,
      title: 'Open diagram'
    })
    if (result.canceled || result.filePaths.length === 0) return null
    const path = result.filePaths[0]
    return { path, diagram: await openDiagramAtPath(path) }
  })

  // No dialog — used for breadcrumb back-navigation, where the absolute
  // path is already known from a previous visit.
  ipcMain.handle('diagram:openPath', async (_event, path: string) => {
    return openDiagramAtPath(path)
  })
}
