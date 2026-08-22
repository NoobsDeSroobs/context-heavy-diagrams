import { dialog, ipcMain } from 'electron'
import { readFile, writeFile } from 'fs/promises'

// Style palette export/import (epic 0030/ADR 0048) — a real file, same
// "sharing means handing someone a file" convention as diagram/icon
// import elsewhere in this app, not a live-sync mechanism. The renderer
// owns the actual JSON shape (settings.ts); main just picks a path and
// moves bytes, same split as diagram.ts.
const FILTERS = [{ name: 'Style palette', extensions: ['json'] }]

export function registerStylePaletteHandlers(): void {
  ipcMain.handle('stylePalette:exportToFile', async (_event, json: string) => {
    const result = await dialog.showSaveDialog({
      title: 'Export style palette',
      defaultPath: 'style-palette.json',
      filters: FILTERS
    })
    if (result.canceled || !result.filePath) return false
    await writeFile(result.filePath, json, 'utf-8')
    return true
  })

  ipcMain.handle('stylePalette:importFromFile', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Import style palette',
      filters: FILTERS,
      properties: ['openFile']
    })
    if (result.canceled || result.filePaths.length === 0) return null
    return readFile(result.filePaths[0], 'utf-8')
  })
}
