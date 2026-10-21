import { app, BrowserWindow, ipcMain, session } from 'electron'
import { electronApp, is, optimizer } from '@electron-toolkit/utils'
import { registerDiagramHandlers } from './diagram'
import { registerIconHandlers } from './icons/icons'
import { registerReferenceHandlers } from './references/references'
import { registerDetailsHandlers } from './details/details'
import { registerLinkHandlers } from './links'
import {
  createWindow,
  focusLastUsedWindow,
  openExternalPaths,
  registerWindowHandlers
} from './windows'
import { diagramPathsFromArgs } from './launchArgs'
import { registerRequiredTagsHandlers } from './tagging/requiredTags'
import { registerRecoveryHandlers, runStartupOrphanScan } from './recovery'
import {
  readPreferences,
  registerPreferencesHandlers,
  seedPreferencesFromInstallOptions
} from './appPreferences'
import { DEFAULT_PREFERENCES } from '@shared/preferences'
import { registerAppInfoHandlers } from './appInfo'
import { registerStylePaletteHandlers } from './styling/stylePalette'
import { registerExportHandlers } from './export/export'
import { registerSecurityHandlers } from './threat-matrix/security'
import { registerLinkedSearchHandlers } from './search/linkedSearch'
import { registerAiHandlers } from './ai'
import { registerClipboardHandlers } from './clipboard'
import { disableProxyDiscovery, enforceOffline } from './offline'

// One running instance (ADR 0108): settings, crash-recovery snapshots and the
// window-by-path registry are all per-user state a second process would
// trample. A second launch exits at once and its command line arrives in this
// process as 'second-instance'. Skipped when not packaged so a dev run never
// fights an installed copy for the lock.
const hasInstanceLock = !app.isPackaged || app.requestSingleInstanceLock()
if (!hasInstanceLock) app.quit()

// Command-line switches only take effect before 'ready' (ADR 0113).
disableProxyDiscovery()

app.on('second-instance', (_event, argv, workingDirectory) => {
  const paths = diagramPathsFromArgs(argv, workingDirectory)
  if (paths.length > 0) openExternalPaths(paths)
  else focusLastUsedWindow()
})

// macOS hands a double-clicked file to the running (or just-starting) app as
// 'open-file', never as an argument, and it can arrive before 'ready' — so it
// is queued until the first window machinery exists.
let appReady = false
const pendingOpenFiles: string[] = []
app.on('open-file', (event, path) => {
  event.preventDefault()
  if (appReady) openExternalPaths([path])
  else pendingOpenFiles.push(path)
})

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(async () => {
  if (!hasInstanceLock) return

  // Set app user model id for windows
  electronApp.setAppUserModelId('com.contextheavydiagrams.app')

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
  registerReferenceHandlers()
  registerDetailsHandlers()
  registerLinkHandlers()
  registerWindowHandlers()
  registerRequiredTagsHandlers()
  registerRecoveryHandlers()
  registerPreferencesHandlers()
  registerAppInfoHandlers()
  registerStylePaletteHandlers()
  registerExportHandlers()
  registerSecurityHandlers()
  registerLinkedSearchHandlers()
  registerAiHandlers()
  registerClipboardHandlers()

  // The renderer never needs camera, microphone, geolocation, notifications or
  // any other permission-gated capability (ADR 0112), so refuse every request.
  session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) =>
    callback(false)
  )

  // Offline by enforcement, not just by habit (ADR 0113). The dev server is
  // the one exception, and only when running `npm run dev`.
  enforceOffline(session.defaultSession, is.dev ? process.env['ELECTRON_RENDERER_URL'] : undefined)

  // Installer-chosen first-run defaults must be in place before any window
  // reads the preferences.
  await seedPreferencesFromInstallOptions()

  // Files the OS launched us with (double-click on Windows/Linux, or
  // open-file queued on macOS) open instead of the blank window; with none, the
  // launch is exactly what it always was. The recovery dialogs hang off the
  // first window either way.
  const launchPaths = [...diagramPathsFromArgs(process.argv, process.cwd()), ...pendingOpenFiles]
  pendingOpenFiles.length = 0
  appReady = true
  const initialWindow = openExternalPaths(launchPaths)[0] ?? createWindow()

  // Not awaited. A diagram that crashed before ever being saved has no path to key a per-window
  // recovery check on (that check runs per window on open), so this scan is the only place it can
  // be found. Gated on the setting because the scan is a real startup cost some users may want to
  // skip (ADR 0040). Runs after createWindow() so the first window doesn't wait on it;
  // initialWindow parents the recovery dialogs for a defined z-order (see runStartupOrphanScan).
  // readPreferences() returning null (no settings.json yet, ADR 0053) can't wait on the renderer's
  // localStorage migration at this point in startup; DEFAULT_PREFERENCES' `true` matches what the
  // replaced file defaulted to on a miss.
  readPreferences().then((settings) => {
    if ((settings ?? DEFAULT_PREFERENCES).scanForUnsavedRecoveryOnStartup) {
      runStartupOrphanScan(initialWindow, createWindow)
    }
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
