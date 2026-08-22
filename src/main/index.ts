import { app, BrowserWindow, ipcMain } from 'electron'
import { electronApp, optimizer } from '@electron-toolkit/utils'
import { registerDiagramHandlers } from './diagram'
import { registerIconHandlers } from './icons'
import { registerDetailsHandlers } from './details'
import { registerLinkHandlers } from './links'
import { createWindow, registerWindowHandlers } from './windows'
import { registerRequiredTagsHandlers } from './requiredTags'
import { registerRecoveryHandlers, runStartupOrphanScan } from './recovery'
import { readScanOnStartupSetting, registerSettingsMirrorHandlers } from './settingsMirror'
import { registerAppInfoHandlers } from './appInfo'

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // IPC test
  ipcMain.on('ping', () => console.log('pong'))

  registerDiagramHandlers()
  registerIconHandlers()
  registerDetailsHandlers()
  registerLinkHandlers()
  registerWindowHandlers()
  registerRequiredTagsHandlers()
  registerRecoveryHandlers()
  registerSettingsMirrorHandlers()
  registerAppInfoHandlers()

  const initialWindow = createWindow()

  // Not awaited — a diagram that crashed before ever being saved once has
  // no path to key a per-window recovery check against (that path runs
  // per-window on open instead, see diagram open flow), so this is the
  // only place it can be found. Gated on the mirrored setting since the
  // scan is a real startup cost some users may want to skip (epic 0020/
  // ADR 0040). Runs after createWindow() so the first window shows up
  // without waiting on this. initialWindow parents the recovery dialog(s)
  // so they get a defined z-order — see runStartupOrphanScan's own comment.
  readScanOnStartupSetting().then((enabled) => {
    if (enabled) runStartupOrphanScan(initialWindow, createWindow)
  })

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
