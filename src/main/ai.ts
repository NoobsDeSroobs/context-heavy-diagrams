import { app, BrowserWindow, dialog, ipcMain } from 'electron'
import { existsSync } from 'fs'
import { dirname, join } from 'path'
import type { AiFolderResult } from '../shared/aiFolderResult'
import { readPreferences } from './appPreferences'
import { installAiFiles } from './aiFolder'

// AI -> "Enable AI assistance in a folder…" (ADR 0105). The OS folder picker is
// the user's consent: nothing is written anywhere they didn't just choose.
// app.getAppPath() is the project root in dev and app.asar when packaged;
// resources/ai/** ships in both (electron-builder.yml, asarUnpack: resources/**).
export function registerAiHandlers(): void {
  ipcMain.handle('ai:enableInFolder', async (event): Promise<AiFolderResult | null> => {
    const win = BrowserWindow.fromWebContents(event.sender)
    const options: Electron.OpenDialogOptions = {
      title: 'Choose the folder that contains your diagrams',
      defaultPath: (await readPreferences())?.lastOpenedDirectory,
      properties: ['openDirectory', 'createDirectory']
    }
    const picked = win
      ? await dialog.showOpenDialog(win, options)
      : await dialog.showOpenDialog(options)
    if (picked.canceled || picked.filePaths.length === 0) return null
    return installAiFiles(
      join(app.getAppPath(), 'resources', 'ai'),
      picked.filePaths[0],
      app.getVersion(),
      installedCliPath()
    )
  })
}

// Where the `chd` launcher sits in an installed app (electron-builder extraFiles,
// ADR 0106). Undefined in dev (no launcher is built) and in an AppImage, whose
// exe lives in a temporary mount — a path written into AGENTS.md would rot.
function installedCliPath(): string | undefined {
  if (!app.isPackaged || process.env.APPIMAGE) return undefined
  const launcher = join(dirname(process.execPath), process.platform === 'win32' ? 'chd.cmd' : 'chd')
  return existsSync(launcher) ? launcher : undefined
}
