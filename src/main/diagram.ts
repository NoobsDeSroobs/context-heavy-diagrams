import { app, BrowserWindow, dialog, ipcMain } from 'electron'
import { readFile } from 'fs/promises'
import { dirname, join } from 'path'
import { parseDiagram, serializeDiagram, type DiagramFile } from '@shared/diagram'
import { stampSavedWith } from '@shared/appVersion'
import type { SaveDocumentRequest, SaveOutcome, Stamp } from '@shared/documentSave'
import { DEFAULT_PREFERENCES, withRecentDiagram } from '@shared/preferences'
import { registerWindowPath } from './windows'
import { deleteRecoverySnapshot } from './recovery'
import { readPreferences, updatePreferences } from './appPreferences'
import { fileStamp } from './fileStamp'
import { executeSave } from './documentSaveExec'
import { resolveLinkPath } from './linkPaths'
import { containedPath } from './containedPath'

// Shared by diagram:openPath and document:save — records `path` in both the
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

  // Saves the diagram and its notes as one plan (ADR 0092): check for conflicts, save everything
  // that doesn't conflict in the crash-safe order (documentSaveExec.ts), and report what was held
  // back so the renderer can ask per file and call again with overwrite: true for just those.
  //
  // Registers this window's path in the windows.ts registry so opening the same file elsewhere
  // focuses this window instead of duplicating it (ADR 0023). That covers Save and the first Save
  // As, the only points where a window's path becomes known if it wasn't opened with one (e.g. File
  // -> New). sessionId is the window's pre-save recovery identity (ADR 0040): a successful save
  // makes any recovery snapshot under it, or under this path from an earlier save, redundant.
  ipcMain.handle(
    'document:save',
    async (event, request: SaveDocumentRequest): Promise<SaveOutcome> => {
      const { diagram, fallbackPaths } = request
      const outcome = await executeSave(
        {
          diagramPath: request.diagramPath,
          writeHub: request.writeHub,
          expectedHubStamp: request.expectedHubStamp,
          ops: request.ops,
          overwrite: request.overwrite
        },
        {
          contain: containedPath,
          stamp: fileStamp,
          serializeHub: (revertNodeIds) => {
            // A note that did not reach its new path (no source to move, or held
            // back by a conflict) must not leave the diagram pointing at a file
            // that doesn't exist: it keeps the old path, or none for a new note.
            for (const id of revertNodeIds) {
              const node = diagram.nodes.find((n) => n.id === id)
              const fallback = fallbackPaths[id]
              if (!node?.data || fallback === undefined) continue
              if (fallback === null) delete node.data.details
              else node.data.details = fallback
            }
            // Record this app's version, but only if it is newer than what the file
            // already says (ADR 0118): an older app never lowers it, and the same
            // version changes nothing.
            diagram.savedWith = stampSavedWith(diagram.savedWith, app.getVersion())
            return serializeDiagram(diagram)
          }
        }
      )
      if (outcome.status !== 'saved') return outcome

      const win = BrowserWindow.fromWebContents(event.sender)
      if (win) registerWindowPath(win, request.diagramPath)
      // Two keys, not one: this path's own (repeat saves reuse it) and the
      // window's pre-save session-id key (only relevant the first time a
      // previously-unsaved window is saved, harmless no-op otherwise). Kept
      // while conflicts are unresolved — those edits are not saved yet.
      if (outcome.conflicts.length === 0) {
        await deleteRecoverySnapshot(request.diagramPath, request.sessionId)
        await deleteRecoverySnapshot(null, request.sessionId)
      }
      // A repeat Save (not just the first Save As) is still real evidence
      // of "actively working in this file" — updates both lastOpenedDirectory
      // and the recent-diagrams list.
      await recordOpenedOrSaved(request.diagramPath)
      return outcome
    }
  )

  // No dialog; used by a window's initial-load mount effect (path from the ?path= query string, ADR
  // 0023). Every open path (File -> Open, linked-diagram navigation, drag-and-drop) funnels through
  // here, so this is the one place that updates lastOpenedDirectory and the recent-diagrams list.
  // Returns the file's stamp, the renderer's baseline for detecting later outside changes (ADR
  // 0092). Stamped BEFORE reading: if the file changes in between, the baseline is older than what
  // we hold, so the next check errs toward "changed" (a harmless extra prompt) rather than missing
  // an outside edit.
  ipcMain.handle(
    'diagram:openPath',
    async (_event, path: string): Promise<{ diagram: DiagramFile; stamp: Stamp }> => {
      await recordOpenedOrSaved(path)
      const stamp = await fileStamp(path)
      const diagram = await openDiagramAtPath(path)
      return { diagram, stamp }
    }
  )

  // Side-effect-free reread for the "changes since last save" diff (ADR 0102) — same precedent as security:crawlLinked. Never calls
  // recordOpenedOrSaved: opening the diff view must not touch
  // lastOpenedDirectory or the recent-diagrams list. Returns null for a
  // path that no longer resolves (deleted/moved since open) rather than
  // throwing — the renderer treats that as "nothing to diff against."
  ipcMain.handle(
    'diagram:rereadForDiff',
    async (_event, path: string): Promise<DiagramFile | null> => {
      try {
        return await openDiagramAtPath(path)
      } catch {
        return null
      }
    }
  )

  // The one detector for "did a file change on disk since I last looked" —
  // used by the window-focus check for both the diagram (relPath null) and any
  // note (folder-relative path). Never `changed` for an entry with no baseline
  // or a file that has vanished. `stamp` is the current fingerprint so the
  // renderer can remember which specific change the user chose to ignore.
  ipcMain.handle(
    'files:check',
    async (
      _event,
      diagramPath: string,
      entries: { relPath: string | null; stamp: Stamp }[]
    ): Promise<{ changed: boolean; stamp: Stamp }[]> =>
      Promise.all(
        entries.map(async (entry) => {
          const stamp = await fileStamp(
            entry.relPath === null ? diagramPath : resolveLinkPath(diagramPath, entry.relPath)
          )
          return {
            changed: entry.stamp !== null && stamp !== null && stamp !== entry.stamp,
            stamp
          }
        })
      )
  )
}
