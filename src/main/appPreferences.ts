import { app, BrowserWindow, ipcMain } from 'electron'
import { readFile, writeFile } from 'fs/promises'
import { join } from 'path'
import { DEFAULT_PREFERENCES, normalizePreferences, type AppPreferences } from '@shared/preferences'

// Real per-OS preferences file (see ADR 0053) — replaces the renderer's
// former localStorage-only storage (ADR 0032) with a file under this OS's
// own conventional per-user app-data location, resolved automatically by
// Electron's own app.getPath('userData'). The on-disk name stays
// `settings.json` despite the "Settings" -> "Preferences" rename (epic
// 0100) — it's what existing installs already have, and renaming it would
// mean a migration for a file no user ever sees.
function preferencesFile(): string {
  return join(app.getPath('userData'), 'settings.json')
}

// Returns null when the file doesn't exist yet — the caller (the
// renderer's usePreferences hook) is the one place that can still reach the
// old localStorage value to migrate from, so it needs to tell "genuinely
// nothing saved yet" apart from "saved, and happens to equal defaults."
export async function readPreferences(): Promise<AppPreferences | null> {
  try {
    const raw = await readFile(preferencesFile(), 'utf-8')
    // Normalize, not a bare parse — fills in defaults for fields an older
    // stored blob predates (same "absent means default" reasoning as the
    // .chd format, ADR 0029) and runs the stylePalette migration (ADR 0068).
    return normalizePreferences(JSON.parse(raw) as Partial<AppPreferences>)
  } catch {
    return null
  }
}

// Main-side partial update, not an IPC handler — for preference fields main
// itself needs to write outside of any renderer-initiated save
// (lastOpenedDirectory: set whenever a dialog picks/loads a path,
// never something the renderer directly edits). Broadcasts to every
// window the same way preferences:write does, so any open renderer's own
// AppPreferences state stays in sync too — no sender to exclude here since
// this isn't triggered by a renderer event.
export async function updatePreferences(patch: Partial<AppPreferences>): Promise<void> {
  const current = (await readPreferences()) ?? DEFAULT_PREFERENCES
  const next = { ...current, ...patch }
  await writeFile(preferencesFile(), JSON.stringify(next), 'utf-8')
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send('preferences:changed', next)
  }
}

export function registerPreferencesHandlers(): void {
  ipcMain.handle('preferences:read', async () => readPreferences())

  ipcMain.handle('preferences:write', async (event, preferences: AppPreferences) => {
    await writeFile(preferencesFile(), JSON.stringify(preferences), 'utf-8')
    // Every *other* window needs to pick up the change — the sender
    // already has it in its own React state, this replaces the
    // `storage` event's free cross-window sync that a shared localStorage
    // key used to provide.
    for (const win of BrowserWindow.getAllWindows()) {
      if (win.webContents.id !== event.sender.id)
        win.webContents.send('preferences:changed', preferences)
    }
  })
}
