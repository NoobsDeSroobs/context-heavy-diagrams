import { BrowserWindow, dialog, ipcMain } from 'electron'
import { readFile, writeFile } from 'fs/promises'
import { dirname, join } from 'path'
import { parseDiagram, serializeDiagram, type DiagramFile } from '@shared/diagram'
import { DEFAULT_PREFERENCES, withRecentDiagram } from '@shared/preferences'
import { registerWindowPath } from './windows'
import { deleteRecoverySnapshot } from './recovery'
import { readPreferences, updatePreferences } from './appPreferences'

// Shared by diagram:openPath and diagram:save — records `path` in both the
// last-opened-directory preference and the recent-diagrams list, in a single
// write+broadcast. Reads current prefs to compute the new list; the TOCTOU
// window is the same one diagram:pickSavePath already accepts (preference
// writes are rare and low-stakes).
async function recordOpenedOrSaved(path: string): Promise<void> {
  const prefs = await readPreferences()
  await updatePreferences({
    lastOpenedDirectory: dirname(path),
    recentDiagrams: withRecentDiagram(
      prefs?.recentDiagrams,
      path,
      prefs?.recentDiagramsLimit ?? DEFAULT_PREFERENCES.recentDiagramsLimit
    )
  })
}

// Diagram files are a single file (.chd, plain JSON underneath) — see
// docs/decisions/0005-diagram-identity-and-linking.md. Nothing about
// opening/saving depends on foldering at all; that's the whole point of
// this model over the folder-based one it replaced (ADR 0003).
const FILTERS = [{ name: 'Diagram', extensions: ['chd'] }]

// The one place that reads+parses a .chd off disk from an already-known
// absolute path — used by diagram:openPath.
export async function openDiagramAtPath(path: string): Promise<DiagramFile> {
  const raw = await readFile(path, 'utf-8')
  return parseDiagram(raw)
}

export function registerDiagramHandlers(): void {
  // defaultPath here is a directory + filename — defaults to
  // wherever the user last opened/saved a diagram, if anywhere, rather
  // than the OS/Electron's own arbitrary default. Absent
  // lastOpenedDirectory (nothing saved yet this install) falls back to
  // the bare filename, today's only prior behavior.
  ipcMain.handle('diagram:pickSavePath', async () => {
    const prefs = await readPreferences()
    const defaultPath = prefs?.lastOpenedDirectory
      ? join(prefs.lastOpenedDirectory, 'New Diagram.chd')
      : 'New Diagram.chd'
    const result = await dialog.showSaveDialog({
      title: 'Save diagram',
      defaultPath,
      filters: FILTERS
    })
    if (result.canceled || !result.filePath) return null
    await updatePreferences({ lastOpenedDirectory: dirname(result.filePath) })
    return result.filePath
  })

  // Registers this window's path in the windows.ts registry so a later
  // attempt to open the same file elsewhere focuses this window instead
  // of opening a duplicate (ADR 0023) — covers both Save and the first
  // Save As, the only two points a window's path becomes known if it
  // wasn't opened with one already (e.g. File -> New). sessionId is the
  // window's pre-save recovery identity (see ADR 0040) — a
  // successful save makes any recovery snapshot under either key (the old
  // session id, or this same path from a previous save) redundant.
  ipcMain.handle(
    'diagram:save',
    async (event, path: string, diagram: DiagramFile, sessionId: string) => {
      await writeFile(path, serializeDiagram(diagram), 'utf-8')
      const win = BrowserWindow.fromWebContents(event.sender)
      if (win) registerWindowPath(win, path)
      // Two keys, not one: this path's own (repeat saves reuse it) and the
      // window's pre-save session-id key (only relevant the first time a
      // previously-unsaved window is saved, harmless no-op otherwise).
      await deleteRecoverySnapshot(path, sessionId)
      await deleteRecoverySnapshot(null, sessionId)
      // A repeat Save (not just the first Save As) is still real evidence
      // of "actively working in this file" — updates both lastOpenedDirectory
      // and the recent-diagrams list.
      await recordOpenedOrSaved(path)
    }
  )

  // No dialog — used by a window's own initial-load mount effect (path
  // passed via ?path= query string, ADR 0023). Every open path (File ->
  // Open, linked-diagram navigation, drag-and-drop) funnels through here
  // eventually, so this is the one place that updates lastOpenedDirectory
  // and the recent-diagrams list to cover all of them, rather than
  // duplicating the update at every dialog/entry point separately.
  ipcMain.handle('diagram:openPath', async (_event, path: string) => {
    await recordOpenedOrSaved(path)
    return openDiagramAtPath(path)
  })
}
