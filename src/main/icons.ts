import { dialog, ipcMain } from 'electron'
import { copyFile, mkdir, readdir, readFile } from 'fs/promises'
import { basename, dirname, extname, join, relative } from 'path'

// Custom icons live in a sibling folder named after the diagram file, per
// ADR 0005's convention and ADR 0006's icon storage model — e.g.
// my-diagram.chd -> my-diagram/assets/. Paths stored on a node are always
// relative to the diagram file's own directory.
function assetsDirFor(diagramPath: string): string {
  const diagramBase = basename(diagramPath, extname(diagramPath))
  return join(dirname(diagramPath), diagramBase, 'assets')
}

async function uniqueDestName(dir: string, fileName: string): Promise<string> {
  const ext = extname(fileName)
  const stem = basename(fileName, ext)
  let candidate = fileName
  let n = 1
  const existing = new Set(await readdir(dir).catch(() => [] as string[]))
  while (existing.has(candidate)) {
    candidate = `${stem}-${n}${ext}`
    n += 1
  }
  return candidate
}

function mimeTypeFor(filePath: string): string {
  return extname(filePath).toLowerCase() === '.png' ? 'image/png' : 'image/svg+xml'
}

export function registerIconHandlers(): void {
  ipcMain.handle('icons:pickAndCopyCustom', async (_event, diagramPath: string) => {
    const result = await dialog.showOpenDialog({
      title: 'Choose an icon',
      properties: ['openFile'],
      filters: [{ name: 'Icon', extensions: ['svg', 'png'] }]
    })
    if (result.canceled || result.filePaths.length === 0) return null

    const dir = assetsDirFor(diagramPath)
    await mkdir(dir, { recursive: true })
    const srcName = basename(result.filePaths[0])
    const destName = await uniqueDestName(dir, srcName)
    const destPath = join(dir, destName)
    await copyFile(result.filePaths[0], destPath)

    return relative(dirname(diagramPath), destPath).split('\\').join('/')
  })

  ipcMain.handle('icons:listCustom', async (_event, diagramPath: string) => {
    const dir = assetsDirFor(diagramPath)
    const files = await readdir(dir).catch(() => [] as string[])
    return files
      .filter((f) => ['.svg', '.png'].includes(extname(f).toLowerCase()))
      .map((f) => relative(dirname(diagramPath), join(dir, f)).split('\\').join('/'))
  })

  ipcMain.handle(
    'icons:readAsDataUrl',
    async (_event, diagramPath: string, relativePath: string) => {
      const fullPath = join(dirname(diagramPath), relativePath)
      const buffer = await readFile(fullPath)
      return `data:${mimeTypeFor(fullPath)};base64,${buffer.toString('base64')}`
    }
  )
}
