import { dialog, ipcMain } from 'electron'
import { writeFile } from 'fs/promises'

// PNG export (epic 0010/ADR 0051) — same "renderer produces bytes, main
// picks a path and writes them" split as stylePalette.ts. The renderer
// hands over a data URL (from html-to-image's toPng) rather than a raw
// buffer since that's what the browser-side capture API already produces;
// stripping the data: prefix here keeps that detail out of the renderer's
// own IPC surface.
const FILTERS = [{ name: 'PNG image', extensions: ['png'] }]

export function registerExportHandlers(): void {
  ipcMain.handle('export:pngToFile', async (_event, dataUrl: string, suggestedFilename: string) => {
    const result = await dialog.showSaveDialog({
      title: 'Export as PNG',
      defaultPath: suggestedFilename,
      filters: FILTERS
    })
    if (result.canceled || !result.filePath) return false
    const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1)
    await writeFile(result.filePath, Buffer.from(base64, 'base64'))
    return true
  })
}
