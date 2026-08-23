import { app, BrowserWindow, ipcMain } from 'electron'
import { readFile, writeFile } from 'fs/promises'
import { join } from 'path'
import { DEFAULT_SETTINGS, type AppSettings } from '@shared/settings'

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
    // Spread over the defaults, not a bare parse — an older stored blob
    // missing a field newer code added should still fill in a sane value,
    // same "absent means default" reasoning as the .chd format (ADR 0029).
    return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<AppSettings>) }
  } catch {
    return null
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
