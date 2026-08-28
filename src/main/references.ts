import { dialog, ipcMain } from 'electron'
import { copyFile, mkdir, readdir, readFile } from 'fs/promises'
import { basename, dirname, extname, join, relative } from 'path'

// Reference images (see ADR 0069) live in a sibling subfolder,
// assets/references/, next to the assets/ folder custom icons use (ADR
// 0006). Same "diagram must be saved first" limitation and same
// relative-path storage convention. This module is icons.ts with a
// different subfolder and a wider extension filter — kept separate rather
// than parameterising icons.ts so each stays a straight read.
const REFERENCE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg']

function referencesDirFor(diagramPath: string): string {
  const diagramBase = basename(diagramPath, extname(diagramPath))
  return join(dirname(diagramPath), diagramBase, 'assets', 'references')
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

const MIME_BY_EXT: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml'
}

function mimeTypeFor(filePath: string): string {
  return MIME_BY_EXT[extname(filePath).toLowerCase()] ?? 'application/octet-stream'
}

export function registerReferenceHandlers(): void {
  // Returns the new relative path, or null on cancel. Multi-select
  // allowed — a reference board is usually assembled from several images
  // at once.
  ipcMain.handle('references:pickAndCopy', async (_event, diagramPath: string) => {
    const result = await dialog.showOpenDialog({
      title: 'Add reference image',
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'Image', extensions: REFERENCE_EXTENSIONS.map((e) => e.slice(1)) }]
    })
    if (result.canceled || result.filePaths.length === 0) return null

    const dir = referencesDirFor(diagramPath)
    await mkdir(dir, { recursive: true })

    const relativePaths: string[] = []
    for (const srcPath of result.filePaths) {
      const destName = await uniqueDestName(dir, basename(srcPath))
      const destPath = join(dir, destName)
      await copyFile(srcPath, destPath)
      relativePaths.push(relative(dirname(diagramPath), destPath).split('\\').join('/'))
    }
    return relativePaths
  })

  ipcMain.handle(
    'references:readAsDataUrl',
    async (_event, diagramPath: string, relativePath: string) => {
      // Split on either separator so a '\'-stored path still resolves on
      // Linux — same reasoning as icons.ts's readAsDataUrl.
      const fullPath = join(dirname(diagramPath), ...relativePath.split(/[\\/]/))
      const buffer = await readFile(fullPath)
      return `data:${mimeTypeFor(fullPath)};base64,${buffer.toString('base64')}`
    }
  )
}
