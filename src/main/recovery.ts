import { app, BrowserWindow, dialog, ipcMain } from 'electron'
import { createHash, randomUUID } from 'crypto'
import { mkdir, readdir, readFile, rm, stat, writeFile } from 'fs/promises'
import { join } from 'path'
import type { DiagramFile } from '@shared/diagram'
import type { NoteBaseline, RecoverySnapshot } from '@shared/documentSave'

// Crash-recovery snapshots (ADR 0040). Stored centrally under userData, never beside the real .chd:
// that would clutter the user's project folder, risk an accidental git commit, and has nowhere to
// live for a never-saved diagram. Each envelope records its own originalPath so a diagram with no
// path yet (originalPath: null) can still be found by the startup orphan scan, which has no path to
// key a lookup on.
// detailsDrafts rides alongside the diagram, not inside it: a details edit only becomes part of
// DiagramFile once persistDiagram's flushDetailsDrafts writes it to a per-node file at save time
// (Canvas.tsx). Without carrying it here, a crash mid-edit of a node's Details text would recover
// everything except that text.
interface RecoveryEnvelope {
  originalPath: string | null
  savedAt: number
  diagram: DiagramFile
  detailsDrafts: Record<string, string>
  // Each draft's note baseline (path, stamp, text) so a restored note can still
  // detect an outside change (ADR 0092). Absent in older snapshots.
  noteBaselines?: Record<string, NoteBaseline>
}

function recoveryDir(): string {
  return join(app.getPath('userData'), 'recovery')
}

async function ensureRecoveryDir(): Promise<string> {
  const dir = recoveryDir()
  await mkdir(dir, { recursive: true })
  return dir
}

function normalizePath(path: string): string {
  return process.platform === 'win32' ? path.toLowerCase() : path
}

// A path-keyed file (hashed, since a raw path isn't filename-safe) once the
// diagram has been saved at least once; otherwise the window's own session
// id, generated at creation and stable for that window's lifetime. The
// renderer decides which applies (it always knows its own currentPath and
// sessionId) — main just needs a stable, collision-free filename either way.
function keyFor(path: string | null, sessionId: string): string {
  return path ? createHash('sha256').update(normalizePath(path)).digest('hex') : sessionId
}

function fileFor(key: string): string {
  return join(recoveryDir(), `${key}.json`)
}

export async function writeRecoverySnapshot(
  path: string | null,
  sessionId: string,
  diagram: DiagramFile,
  detailsDrafts: Record<string, string>,
  noteBaselines?: Record<string, NoteBaseline>
): Promise<void> {
  await ensureRecoveryDir()
  const envelope: RecoveryEnvelope = {
    originalPath: path,
    savedAt: Date.now(),
    diagram,
    detailsDrafts,
    noteBaselines
  }
  await writeFile(fileFor(keyFor(path, sessionId)), JSON.stringify(envelope), 'utf-8')
}

async function readEnvelope(file: string): Promise<RecoveryEnvelope | null> {
  try {
    return JSON.parse(await readFile(file, 'utf-8')) as RecoveryEnvelope
  } catch {
    return null
  }
}

export async function deleteRecoverySnapshot(
  path: string | null,
  sessionId: string
): Promise<void> {
  try {
    await rm(fileFor(keyFor(path, sessionId)))
  } catch {
    // Nothing to delete — a window that was never dirty never wrote one.
  }
}

// Only newer-than-the-real-file recovery snapshots are worth surfacing —
// an older one is just a stale leftover from a previous, since-superseded
// save. Silently ignored (not deleted) since it's harmless and cleaned up
// by writeRecoverySnapshot's own key reuse the next time this diagram is dirtied.
export async function checkRecoveryForPath(path: string): Promise<RecoverySnapshot | null> {
  const envelope = await readEnvelope(fileFor(keyFor(path, '')))
  if (!envelope) return null
  try {
    const realStat = await stat(path)
    if (envelope.savedAt <= realStat.mtimeMs) return null
  } catch {
    // Real file unreadable/missing — let the normal open flow surface that
    // error instead of this recovery check.
    return null
  }
  return {
    diagram: envelope.diagram,
    detailsDrafts: envelope.detailsDrafts,
    noteBaselines: envelope.noteBaselines
  }
}

interface OrphanEntry {
  key: string
  snapshot: RecoverySnapshot
}

async function listOrphans(): Promise<OrphanEntry[]> {
  const dir = recoveryDir()
  let entries: string[]
  try {
    entries = await readdir(dir)
  } catch {
    return []
  }
  const orphans: OrphanEntry[] = []
  for (const entry of entries) {
    const envelope = await readEnvelope(join(dir, entry))
    if (envelope && envelope.originalPath === null) {
      orphans.push({
        key: entry.replace(/\.json$/, ''),
        snapshot: {
          diagram: envelope.diagram,
          detailsDrafts: envelope.detailsDrafts,
          noteBaselines: envelope.noteBaselines
        }
      })
    }
  }
  return orphans
}

async function discardOrphan(key: string): Promise<void> {
  try {
    await rm(fileFor(key))
  } catch {
    // Already gone — fine.
  }
}

// Run once at app startup (gated by the caller on the real preferences file, see
// appPreferences.ts). Sequential native dialogs, one per orphan: orphans are rare (only diagrams
// that crashed before ever being saved), so no batch UI. Each recovered orphan opens in its own
// window with the snapshot's content, still unsaved (the window gets a fresh session id, see
// windows.ts's createWindow, so periodic autosave picks it up under that identity within ~60s).
// openWindow is injected, not imported from windows.ts, which itself needs
// deleteRecoverySnapshot/newSessionId from this module: that avoids a circular dependency.
// ownerWindow parents the dialog to the app's initial window, because an unparented dialog has no
// guaranteed z-order and has been seen opening behind the app.
export async function runStartupOrphanScan(
  ownerWindow: BrowserWindow,
  openWindow: () => BrowserWindow
): Promise<void> {
  const orphans = await listOrphans()
  for (const orphan of orphans) {
    const result = await dialog.showMessageBox(ownerWindow, {
      type: 'question',
      buttons: ['Recover', 'Discard'],
      defaultId: 0,
      cancelId: 1,
      title: 'Recover unsaved diagram?',
      message: 'A diagram that was never saved has unsaved changes from an unexpected close.',
      detail: 'Recover it into a new window, or discard the recovered copy?'
    })
    if (result.response === 0) {
      const win = openWindow()
      win.webContents.once('did-finish-load', () => {
        win.webContents.send('recovery:loadOrphan', orphan.snapshot)
      })
      await discardOrphan(orphan.key)
    } else {
      await discardOrphan(orphan.key)
    }
  }
}

export function newSessionId(): string {
  return randomUUID()
}

export function registerRecoveryHandlers(): void {
  ipcMain.handle(
    'recovery:write',
    async (
      _event,
      path: string | null,
      sessionId: string,
      diagram: DiagramFile,
      detailsDrafts: Record<string, string>,
      noteBaselines?: Record<string, NoteBaseline>
    ) => {
      await writeRecoverySnapshot(path, sessionId, diagram, detailsDrafts, noteBaselines)
    }
  )

  ipcMain.handle('recovery:delete', async (_event, path: string | null, sessionId: string) => {
    await deleteRecoverySnapshot(path, sessionId)
  })

  ipcMain.handle('recovery:checkForPath', async (_event, path: string) => {
    return checkRecoveryForPath(path)
  })
}
