import { clipboard, ipcMain } from 'electron'

// The sandboxed preload cannot use Electron's `clipboard` module (ADR 0112), so
// the main process does it. Copy is fire-and-forget; paste reads synchronously
// because the renderer's paste handler is synchronous and reading the clipboard
// is instant (still the real OS clipboard, ADR 0049).
export function registerClipboardHandlers(): void {
  ipcMain.on('clipboard:writeText', (_event, text: unknown) => {
    if (typeof text === 'string') clipboard.writeText(text)
  })
  ipcMain.on('clipboard:readText', (event) => {
    event.returnValue = clipboard.readText()
  })
}
