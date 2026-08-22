import { app, ipcMain } from 'electron'
import { readFile, writeFile } from 'fs/promises'
import { join } from 'path'

// A single mirrored boolean, not the renderer's full AppSettings — see
// ADR 0040. The startup orphan scan (recovery.ts) needs to know whether
// it's enabled before any renderer/localStorage exists, which the normal
// settings.ts storage can't provide. The renderer's Settings panel remains
// the source of truth the user actually edits; this file is just a copy
// main can read synchronously-in-spirit at startup.
function mirrorFile(): string {
  return join(app.getPath('userData'), 'startup-scan-setting.json')
}

export async function readScanOnStartupSetting(): Promise<boolean> {
  try {
    const raw = await readFile(mirrorFile(), 'utf-8')
    const parsed = JSON.parse(raw) as { scanForUnsavedRecoveryOnStartup?: boolean }
    return parsed.scanForUnsavedRecoveryOnStartup ?? true
  } catch {
    return true
  }
}

export function registerSettingsMirrorHandlers(): void {
  ipcMain.handle('settings:mirrorScanOnStartup', async (_event, value: boolean) => {
    await writeFile(mirrorFile(), JSON.stringify({ scanForUnsavedRecoveryOnStartup: value }), 'utf-8')
  })
}
