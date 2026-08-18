import { dialog, ipcMain } from 'electron'
import { mkdir, readFile, writeFile } from 'fs/promises'
import { basename, dirname, extname, join } from 'path'
import { parseDiagram, serializeDiagram, type DiagramFile } from '@shared/diagram'

// Internal handlers only — the renderer-facing contract (openDiagram /
// saveDiagramAs / saveDiagram) lives in the preload script, which
// orchestrates pickSaveFolder + saveNew into a single saveDiagramAs call.
// See docs/decisions/0003-diagram-persistence-v1.md.
export function registerDiagramHandlers(): void {
  // showSaveDialog, not showOpenDialog: lets the user actually type a name
  // (the standard native "Save As" experience) rather than only picking or
  // creating a folder via the OS folder browser's own "New folder" button.
  // What they type becomes the diagram's folder name — the same pattern
  // macOS uses for bundle formats (.pages, .key) that are folders under
  // the hood but presented as a single named "file" to the user.
  ipcMain.handle('diagram:pickSaveFolder', async () => {
    const result = await dialog.showSaveDialog({
      title: 'Name your diagram',
      defaultPath: 'New Diagram',
      buttonLabel: 'Create'
    })
    if (result.canceled || !result.filePath) return null
    // The dialog looks like a normal "name a file" prompt, so users
    // reasonably type a trailing ".json" expecting a file. We're using
    // their input as a folder name (temporary — epic 0015 replaces this
    // whole folder model), so strip a typed .json rather than creating a
    // folder literally named "whatever.json".
    if (extname(result.filePath).toLowerCase() === '.json') {
      return join(dirname(result.filePath), basename(result.filePath, extname(result.filePath)))
    }
    return result.filePath
  })

  ipcMain.handle('diagram:saveNew', async (_event, dir: string, diagram: DiagramFile) => {
    await mkdir(dir, { recursive: true })
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
