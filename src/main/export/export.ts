import { dialog, ipcMain } from 'electron'
import { writeFile } from 'fs/promises'

// PNG export (see ADR 0051) — same "renderer produces bytes, main
// picks a path and writes them" split as stylePalette.ts. The renderer
// hands over a data URL (from html-to-image's toPng) rather than a raw
// buffer since that's what the browser-side capture API already produces;
// stripping the data: prefix here keeps that detail out of the renderer's
// own IPC surface. SVG export (ADR 0124) hands over the document text.
const FILTERS = [{ name: 'PNG image', extensions: ['png'] }]
const SVG_FILTERS = [{ name: 'SVG image', extensions: ['svg'] }]

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

  ipcMain.handle('export:svgToFile', async (_event, svg: string, suggestedFilename: string) => {
    const result = await dialog.showSaveDialog({
      title: 'Export as SVG',
      defaultPath: suggestedFilename,
      filters: SVG_FILTERS
    })
    if (result.canceled || !result.filePath) return false
    await writeFile(result.filePath, svg, 'utf-8')
    return true
  })
}
