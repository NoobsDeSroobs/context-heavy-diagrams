import { app, ipcMain } from 'electron'

// Single source of truth is package.json's own "version" field (ADR 0044) —
// app.getVersion() reads it automatically, so the renderer never needs its
// own copy.
export function registerAppInfoHandlers(): void {
  ipcMain.handle('app:getVersion', () => app.getVersion())
}
