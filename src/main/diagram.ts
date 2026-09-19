import { BrowserWindow, dialog, ipcMain, type IpcMainInvokeEvent } from 'electron'
import { readFile, writeFile } from 'fs/promises'
import { dirname, join } from 'path'
import { parseDiagram, serializeDiagram, type DiagramFile } from '@shared/diagram'
import { DEFAULT_PREFERENCES, withRecentDiagram } from '@shared/preferences'
import { registerWindowPath } from './windows'
import { deleteRecoverySnapshot } from './recovery'
import { readPreferences, updatePreferences } from './appPreferences'
import { fileStamp } from './fileStamp'

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

// What each window last saw of its own diagram file on disk — recorded when
// the window loads (diagram:openPath) or saves (diagram:save), compared later
// by diagram:checkExternalChange to notice a change made outside the app
// (docs/decisions/0091-external-change-detection.md). Keyed by the window's
// webContents id; `path` is stored too so a Save As to a *different* path
// (whose overwrite the OS save dialog already confirmed) isn't judged against
// the old file's stamp.
const diskBaselines = new Map<number, { path: string; stamp: string | null }>()

function recordBaseline(event: IpcMainInvokeEvent, path: string, stamp: string | null): void {
  const id = event.sender.id
  if (!diskBaselines.has(id)) event.sender.once('destroyed', () => diskBaselines.delete(id))
  diskBaselines.set(id, { path, stamp })
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
      recordBaseline(event, path, await fileStamp(path))
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
  ipcMain.handle('diagram:openPath', async (event, path: string) => {
    await recordOpenedOrSaved(path)
    // Stamp BEFORE reading: if the file changes in between, the baseline is
    // older than what we hold, so the next check errs toward "changed" (a
    // harmless extra prompt) rather than missing an outside edit.
    const stamp = await fileStamp(path)
    const diagram = await openDiagramAtPath(path)
    recordBaseline(event, path, stamp)
    return diagram
  })

  // Has this window's diagram file been modified outside the app since this
  // window last loaded or saved it? Never true for a path this window has no
  // baseline for (a never-saved diagram, or a fresh Save As target), or when
  // the file is gone (a save just recreates it). `stamp` is the file's
  // current fingerprint, so the renderer can remember "the user dismissed
  // the banner for this specific change" without touching the baseline.
  ipcMain.handle('diagram:checkExternalChange', async (event, path: string) => {
    const baseline = diskBaselines.get(event.sender.id)
    const stamp = await fileStamp(path)
    const changed =
      baseline !== undefined &&
      baseline.path === path &&
      stamp !== null &&
      stamp !== baseline.stamp
    return { changed, stamp }
  })

  // The conflict popup. Native message box (same as the close prompt) — the
  // app deliberately doesn't merge; git is the merge tool, so the choices are
  // just "back out to git", "mine wins", "theirs wins".
  // what: 'diagram' for the .chd file, 'details' for one or more detail notes.
  ipcMain.handle(
    'diagram:confirmExternalChange',
    async (event, what: 'diagram' | 'details', dirty: boolean, names: string[]) => {
      const win = BrowserWindow.fromWebContents(event.sender)
      const subject =
        what === 'diagram'
          ? 'This diagram file'
          : names.length === 1
            ? `The detail notes for "${names[0]}"`
            : `The detail notes for ${names.length} elements (${names.slice(0, 3).join(', ')}${names.length > 3 ? ', …' : ''})`
      const message = dirty
        ? `${subject} has unsaved changes in the editor AND was also changed outside the app.`
        : `${subject} was changed outside the app since it was loaded.`
      const options = {
        type: 'warning' as const,
        buttons: ['Cancel', 'Overwrite with editor version', 'Reload from disk'],
        defaultId: 0,
        cancelId: 0,
        title: 'Changed outside the app',
        message,
        detail:
          'To keep both versions: Cancel, commit the file as it is on disk (e.g. in git), come back and save to overwrite it, then reconcile the two versions in git.\n\n' +
          'Overwrite replaces the file on disk with what is in the editor. Reload discards the editor version and loads the file from disk.'
      }
      const result = win
        ? await dialog.showMessageBox(win, options)
        : await dialog.showMessageBox(options)
      return (['cancel', 'overwrite', 'reload'] as const)[result.response]
    }
  )
}
