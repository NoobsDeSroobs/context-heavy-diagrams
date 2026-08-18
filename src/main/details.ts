import { ipcMain } from 'electron'
import { mkdir, readFile, writeFile } from 'fs/promises'
import { basename, dirname, extname, join, relative } from 'path'

// Detail files live in a sibling folder named after the diagram file, same
// convention as custom icons (ADR 0006) — e.g. my-diagram.chd ->
// my-diagram/details/<node-id>.md. Unlike icons, there's no user-supplied
// source file to name from, so the filename is always just the node's id —
// but the *reference* stored on the node (data.details) is still a plain
// relative path, not something a reader has to know this convention to use.
function detailsDirFor(diagramPath: string): string {
  const diagramBase = basename(diagramPath, extname(diagramPath))
  return join(dirname(diagramPath), diagramBase, 'details')
}

export function registerDetailsHandlers(): void {
  ipcMain.handle('details:read', async (_event, diagramPath: string, relativePath: string) => {
    try {
      return await readFile(join(dirname(diagramPath), relativePath), 'utf-8')
    } catch {
      return ''
    }
  })

  ipcMain.handle(
    'details:write',
    async (_event, diagramPath: string, nodeId: string, content: string) => {
      const dir = detailsDirFor(diagramPath)
      await mkdir(dir, { recursive: true })
      const filePath = join(dir, `${nodeId}.md`)
      await writeFile(filePath, content, 'utf-8')
      return relative(dirname(diagramPath), filePath).split('\\').join('/')
    }
  )
}
