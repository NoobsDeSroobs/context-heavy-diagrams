import { dialog, ipcMain } from 'electron'
import { readFile, writeFile } from 'fs/promises'
import { join } from 'path'
import { parseDiagram, serializeDiagram, type DiagramFile } from '@shared/diagram'

// Internal handlers only — the renderer-facing contract (openDiagram /
// saveDiagramAs / saveDiagram) lives in the preload script, which
// orchestrates pickDirectory + saveNew into a single saveDiagramAs call.
// See docs/decisions/0003-diagram-persistence-v1.md.
export function registerDiagramHandlers(): void {
  ipcMain.handle('diagram:pickDirectory', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory', 'createDirectory'],
      title: 'Choose or create the diagram folder'
    })
    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths[0]
  })

  ipcMain.handle('diagram:saveNew', async (_event, dir: string, diagram: DiagramFile) => {
    const path = join(dir, 'diagram.json')
    await writeFile(path, serializeDiagram(diagram), 'utf-8')
    return path
  })

  ipcMain.handle('diagram:save', async (_event, path: string, diagram: DiagramFile) => {
    await writeFile(path, serializeDiagram(diagram), 'utf-8')
  })

  ipcMain.handle('diagram:open', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'Diagram', extensions: ['json'] }],
      title: 'Open diagram.json'
    })
    if (result.canceled || result.filePaths.length === 0) return null
    const path = result.filePaths[0]
    const raw = await readFile(path, 'utf-8')
    return { path, diagram: parseDiagram(raw) }
  })
}
