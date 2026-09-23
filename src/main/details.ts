import { ipcMain } from 'electron'
import { readFile } from 'fs/promises'
import type { Stamp } from '@shared/documentSave'
import { fileStamp } from './fileStamp'
import { resolveLinkPath } from './linkPaths'

// Reading detail notes. *Writing* (and renaming to follow a label) is part of
// the multi-file save in documentSaveExec.ts / diagram.ts (ADR 0092); the path
// a note belongs at is derived in @shared/detailPaths.
export function registerDetailsHandlers(): void {
  ipcMain.handle('details:read', async (_event, diagramPath: string, relativePath: string) => {
    try {
      return await readFile(resolveLinkPath(diagramPath, relativePath), 'utf-8')
    } catch {
      return ''
    }
  })

  // Content plus the file's fingerprint, for a note being opened for editing.
  // Stamped BEFORE reading so a change in between is caught, not missed (see
  // diagram:openPath). The renderer keeps it as the note's baseline.
  ipcMain.handle(
    'details:readWithStamp',
    async (
      _event,
      diagramPath: string,
      relativePath: string
    ): Promise<{ content: string; stamp: Stamp }> => {
      const path = resolveLinkPath(diagramPath, relativePath)
      const stamp = await fileStamp(path)
      try {
        return { content: await readFile(path, 'utf-8'), stamp }
      } catch {
        return { content: '', stamp }
      }
    }
  )
}
