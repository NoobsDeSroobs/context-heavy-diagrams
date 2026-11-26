import { ipcMain } from 'electron'
import { readdir, readFile } from 'fs/promises'
import { basename, dirname, extname, join, relative } from 'path'
import { resolveLinkPath } from '../links/linkPaths'

// Custom icons live in a sibling folder named after the diagram file, per
// ADR 0005's convention — e.g.
// my-diagram.chd -> my-diagram/assets/. Paths stored on a node are always
// relative to the diagram file's own directory. They are only read now: a new icon goes into the
// Misc icons pack (ADR 0188).
function assetsDirFor(diagramPath: string): string {
  const diagramBase = basename(diagramPath, extname(diagramPath))
  return join(dirname(diagramPath), diagramBase, 'assets')
}

function mimeTypeFor(filePath: string): string {
  return extname(filePath).toLowerCase() === '.png' ? 'image/png' : 'image/svg+xml'
}

export function registerIconHandlers(): void {
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
      const fullPath = resolveLinkPath(diagramPath, relativePath)
      const buffer = await readFile(fullPath)
      return `data:${mimeTypeFor(fullPath)};base64,${buffer.toString('base64')}`
    }
  )
}
