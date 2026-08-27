import { app, BrowserWindow, ipcMain } from 'electron'
import { readFile, writeFile } from 'fs/promises'
import { join } from 'path'
import { DEFAULT_SETTINGS, normalizeAppSettings, type AppSettings } from '@shared/settings'

// Real per-OS settings file (epic 0054/ADR 0053) — replaces the renderer's
// former localStorage-only storage (ADR 0032) with a file under this OS's
// own conventional per-user app-data location, resolved automatically by
// Electron's own app.getPath('userData'). Same "one JSON file" shape
// settingsMirror.ts already used for its single mirrored boolean, now
// generalized to the whole settings object — that file is retired
// entirely by this one, main can read the real settings directly at
// startup instead of needing a separate narrow mirror.
function settingsFile(): string {
  return join(app.getPath('userData'), 'settings.json')
}

// Returns null when the file doesn't exist yet — the caller (the
// renderer's useSettings hook) is the one place that can still reach the
// old localStorage value to migrate from, so it needs to tell "genuinely
// nothing saved yet" apart from "saved, and happens to equal defaults."
export async function readAppSettings(): Promise<AppSettings | null> {
  try {
    const raw = await readFile(settingsFile(), 'utf-8')
    // Normalize, not a bare parse — fills in defaults for fields an older
    // stored blob predates (same "absent means default" reasoning as the
    // .chd format, ADR 0029) and runs the epic 0074 stylePalette migration.
    return normalizeAppSettings(JSON.parse(raw) as Partial<AppSettings>)
  } catch {
    return null
  }
}

// Main-side partial update, not an IPC handler — for settings fields main
// itself needs to write outside of any renderer-initiated save (epic
// 0091's lastOpenedDirectory: set whenever a dialog picks/loads a path,
// never something the renderer directly edits). Broadcasts to every
// window the same way settings:write does, so any open renderer's own
// AppSettings state stays in sync too — no sender to exclude here since
// this isn't triggered by a renderer event.
export async function updateAppSettings(patch: Partial<AppSettings>): Promise<void> {
  const current = (await readAppSettings()) ?? DEFAULT_SETTINGS
  const next = { ...current, ...patch }
  await writeFile(settingsFile(), JSON.stringify(next), 'utf-8')
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send('settings:changed', next)
  }
}

export function registerAppSettingsHandlers(): void {
  ipcMain.handle('settings:read', async () => readAppSettings())

  ipcMain.handle('settings:write', async (event, settings: AppSettings) => {
    await writeFile(settingsFile(), JSON.stringify(settings), 'utf-8')
    // Every *other* window needs to pick up the change — the sender
    // already has it in its own React state, this replaces the
    // `storage` event's free cross-window sync that a shared localStorage
    // key used to provide.
    for (const win of BrowserWindow.getAllWindows()) {
      if (win.webContents.id !== event.sender.id) win.webContents.send('settings:changed', settings)
    }
  })
}
