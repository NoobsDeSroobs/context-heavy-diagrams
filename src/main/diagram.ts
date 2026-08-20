import { BrowserWindow, dialog, ipcMain } from 'electron'
import { readFile, writeFile } from 'fs/promises'
import { parseDiagram, serializeDiagram, type DiagramFile } from '@shared/diagram'
import { registerWindowPath } from './windows'

// Diagram files are a single file (.chd, plain JSON underneath) — see
// docs/decisions/0005-diagram-identity-and-linking.md. Nothing about
// opening/saving depends on foldering at all; that's the whole point of
// this model over the folder-based one it replaced (ADR 0003).
const FILTERS = [{ name: 'Diagram', extensions: ['chd'] }]

// The one place that reads+parses a .chd off disk from an already-known
// absolute path — used by diagram:openPath.
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

  // Registers this window's path in the windows.ts registry so a later
  // attempt to open the same file elsewhere focuses this window instead
  // of opening a duplicate (ADR 0023) — covers both Save and the first
  // Save As, the only two points a window's path becomes known if it
  // wasn't opened with one already (e.g. File -> New).
  ipcMain.handle('diagram:save', async (event, path: string, diagram: DiagramFile) => {
    await writeFile(path, serializeDiagram(diagram), 'utf-8')
    const win = BrowserWindow.fromWebContents(event.sender)
    if (win) registerWindowPath(win, path)
  })

  // No dialog — used by a window's own initial-load mount effect (path
  // passed via ?path= query string, ADR 0023).
  ipcMain.handle('diagram:openPath', async (_event, path: string) => {
    return openDiagramAtPath(path)
  })
}
