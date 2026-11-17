import { app, BrowserWindow, dialog, ipcMain, shell, type IpcMainInvokeEvent } from 'electron'
import { mkdir } from 'fs/promises'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import icon from '../../../resources/icon.png?asset'
import type { InstallResult, PackList, RemoveResult } from '@shared/icons/installedPacks'
import { isSafeExternalUrl, isSameDocument } from '../navigationGuard'
import { installPack, listPacks, removePack } from './packStore'

// The icon pack manager (ADR 0188): the one place packs are installed, updated and removed. Its own
// window with its own small bridge (src/preload/iconPacks.ts); the editor windows can open it and
// read the list, and cannot change a pack.

// Packs are per user and per machine, next to the saved preferences, never in the install folder.
export function iconPacksFolder(): string {
  return join(app.getPath('userData'), 'icon-packs')
}

let managerWindow: BrowserWindow | null = null
// The install under way, if any: the manager runs one at a time.
let running: { cancelled: boolean } | null = null

function openManager(): void {
  if (managerWindow && !managerWindow.isDestroyed()) {
    if (managerWindow.isMinimized()) managerWindow.restore()
    managerWindow.focus()
    return
  }
  const win = new BrowserWindow({
    width: 760,
    height: 620,
    minWidth: 520,
    minHeight: 420,
    show: false,
    title: 'Icon packs',
    ...(process.platform === 'linux' || (is.dev && process.platform !== 'darwin') ? { icon } : {}),
    webPreferences: { preload: join(__dirname, '../preload/iconPacks.js'), sandbox: true }
  })
  managerWindow = win
  win.setMenuBarVisibility(false)
  win.on('ready-to-show', () => win.show())
  // Closing mid-install cancels it, so nothing half-installed is left.
  win.on('closed', () => {
    if (running) running.cancelled = true
    managerWindow = null
  })
  win.webContents.setWindowOpenHandler((details) => {
    if (isSafeExternalUrl(details.url)) shell.openExternal(details.url)
    return { action: 'deny' }
  })
  win.webContents.on('will-navigate', (event, url) => {
    if (isSameDocument(url, win.webContents.getURL())) return
    event.preventDefault()
    if (isSafeExternalUrl(url)) shell.openExternal(url)
  })
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(`${process.env['ELECTRON_RENDERER_URL']}?iconPacks`)
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'), { query: { iconPacks: '1' } })
  }
}

function announceChange(): void {
  for (const win of BrowserWindow.getAllWindows()) win.webContents.send('iconPacks:changed')
}

// Only the manager window changes packs, whatever another window sends.
function fromManager(event: IpcMainInvokeEvent): BrowserWindow | null {
  return managerWindow && !managerWindow.isDestroyed() && event.sender === managerWindow.webContents
    ? managerWindow
    : null
}

export function registerIconPackHandlers(): void {
  ipcMain.handle('iconPacks:open', () => openManager())

  ipcMain.handle('iconPacks:list', async (): Promise<PackList> => {
    const folder = iconPacksFolder()
    return { folder, packs: await listPacks(folder) }
  })

  ipcMain.handle('iconPacks:install', async (event): Promise<InstallResult> => {
    const win = fromManager(event)
    if (!win) return { status: 'failed', message: 'Packs are installed in the icon pack manager.' }
    if (running) return { status: 'failed', message: 'An install is already running.' }
    const picked = await dialog.showOpenDialog(win, {
      title: 'Choose the folder of a pack',
      properties: ['openDirectory']
    })
    if (picked.canceled || picked.filePaths.length === 0) return { status: 'cancelled' }
    const job = { cancelled: false }
    running = job
    try {
      const result = await installPack(iconPacksFolder(), picked.filePaths[0], {
        onProgress: (progress) => {
          if (!win.isDestroyed()) win.webContents.send('iconPacks:progress', progress)
        },
        isCancelled: () => job.cancelled
      })
      if (result.status === 'installed') announceChange()
      return result
    } finally {
      running = null
    }
  })

  ipcMain.handle('iconPacks:cancelInstall', (event) => {
    if (fromManager(event) && running) running.cancelled = true
  })

  ipcMain.handle('iconPacks:remove', async (event, folder: unknown): Promise<RemoveResult> => {
    const win = fromManager(event)
    if (!win || typeof folder !== 'string') return { ok: false, message: 'Not a pack.' }
    const pack = (await listPacks(iconPacksFolder())).find((p) => p.folder === folder)
    if (!pack) return { ok: false, message: 'That pack is no longer there.' }
    const answer = await dialog.showMessageBox(win, {
      type: 'question',
      buttons: ['Remove', 'Cancel'],
      defaultId: 1,
      cancelId: 1,
      title: 'Remove icon pack',
      message: `Remove the icon pack "${pack.meta.name}"?`,
      detail:
        'It is moved to the trash. Diagrams that use its icons will show them as missing until it is installed again.'
    })
    if (answer.response !== 0) return { ok: false, message: '' }
    const result = await removePack(iconPacksFolder(), folder, (path) => shell.trashItem(path))
    if (result.ok) announceChange()
    return result
  })

  ipcMain.handle('iconPacks:showFolder', async (event) => {
    if (!fromManager(event)) return
    const folder = iconPacksFolder()
    await mkdir(folder, { recursive: true })
    await shell.openPath(folder)
  })
}
