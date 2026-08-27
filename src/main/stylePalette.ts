import { dialog, ipcMain } from 'electron'
import { readFile, writeFile } from 'fs/promises'
import { basename, extname } from 'path'

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

  // Returns the file name (sans extension) alongside its contents — epic
  // 0074 seeds the new palette's name from it, editable afterwards. null
  // on cancel, same convention as before.
  ipcMain.handle('stylePalette:importFromFile', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Import style palette',
      filters: FILTERS,
      properties: ['openFile']
    })
    if (result.canceled || result.filePaths.length === 0) return null
    const path = result.filePaths[0]
    return {
      name: basename(path, extname(path)),
      content: await readFile(path, 'utf-8')
    }
  })
}
