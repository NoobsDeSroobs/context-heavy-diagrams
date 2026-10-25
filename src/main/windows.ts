import { BrowserWindow, dialog, ipcMain, shell } from 'electron'
import { access } from 'fs/promises'
import { basename, join } from 'path'
import { is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { deleteRecoverySnapshot, newSessionId } from './document/recovery'
import { readPreferences, updatePreferences } from './preferences/appPreferences'
import { resolveLinkPath } from './links/linkPaths'
import { isSafeExternalUrl, isSameDocument } from './navigationGuard'

const FILTERS = [{ name: 'Diagram', extensions: ['chd'] }]

// One BrowserWindow per open diagram (ADR 0023) — this registry lets
// opening a diagram already open elsewhere focus that window instead of
// opening a second one on the same file, which would be a silent-overwrite
// risk with no dirty-tracking yet (see ADR 0040). Keyed by normalized
// absolute path.
const windowsByPath = new Map<string, BrowserWindow>()

// Most recently focused window, for focusLastUsedWindow. Electron has no
// "last active window" query of its own, and getFocusedWindow() is null
// whenever the app itself is in the background — exactly when a second launch
// arrives.
let lastFocusedWindow: BrowserWindow | null = null

function normalizePath(path: string): string {
  return process.platform === 'win32' ? path.toLowerCase() : path
}

function unregisterWindow(win: BrowserWindow): void {
  for (const [key, existing] of windowsByPath) {
    if (existing === win) windowsByPath.delete(key)
  }
}

// Exported for diagram.ts's save handler: a window's path is only known once it is saved (or opened
// with one). Clears this window's own previous entry first: a window shows one path at a time, but
// the Map is keyed by path, not by window, so nothing enforced that. It never showed until
// drag-to-open navigated the same non-empty window to new paths repeatedly: dropping file2 "Open
// Here" onto a window showing file1 left both `file1 -> win` and `file2 -> win`, so dropping file1
// again found the stale entry and focused the already-focused window instead of loading it.
export function registerWindowPath(win: BrowserWindow, path: string): void {
  unregisterWindow(win)
  windowsByPath.set(normalizePath(path), win)
}

function findWindowForPath(path: string): BrowserWindow | undefined {
  return windowsByPath.get(normalizePath(path))
}

// Navigates an existing window to a path (re-registers it too) — shared
// by createWindow's initial load and by reusing an already-open, empty
// window instead of spawning a new one (see openOrFocusWindow below).
function loadPathIntoWindow(win: BrowserWindow, path: string): void {
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(`${process.env['ELECTRON_RENDERER_URL']}?path=${encodeURIComponent(path)}`)
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'), { query: { path } })
  }
  registerWindowPath(win, path)
}

// A window's own identity for crash-recovery purposes (see ADR 0040)
// before it's ever been saved — generated once here, carried to the
// renderer via a ?session= query string alongside (or instead of) ?path=,
// same mechanism. Once a window has a real path, recovery keys off that
// instead; this id only matters for a diagram that's never been saved.
function blankWindowUrl(baseUrl: string, sessionId: string): string {
  const separator = baseUrl.includes('?') ? '&' : '?'
  return `${baseUrl}${separator}session=${encodeURIComponent(sessionId)}`
}

// Real OS close (close button, Alt+F4) is intercepted so the renderer gets
// a chance to check its own dirty state and, if needed, drive a
// Save/Discard/Cancel prompt before the window actually goes away — see
// ADR 0040. `closeApproved` distinguishes a close this guard has
// already cleared (call win.close() again without re-triggering the
// prompt) from a fresh OS-initiated one.
const closeApproved = new WeakSet<BrowserWindow>()

function attachCloseGuard(win: BrowserWindow): void {
  win.on('close', (event) => {
    if (closeApproved.has(win)) return
    event.preventDefault()
    win.webContents.send('window:closeRequested')
  })
}

// initialPath, when given, is passed to the renderer via a ?path= query
// string rather than read here — the new window's own mount effect loads
// it through the existing diagram:openPath IPC, reusing tested code
// instead of duplicating file-read logic in main.
export function createWindow(initialPath?: string): BrowserWindow {
  const win = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    // Not autoHideMenuBar: that only hides the native menu until Alt is pressed,
    // and Alt is the duplicate-drag modifier (ADR 0099). The app draws its own
    // menu in the renderer; the native one stays hidden via setMenuBarVisibility.
    // Linux has no icon resource in the executable, and a dev run on any OS starts the stock
    // Electron binary. A packaged Windows or macOS build carries the icon in the executable.
    ...(process.platform === 'linux' || (is.dev && process.platform !== 'darwin') ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      // Sandboxed preload: it can only use ipcRenderer/contextBridge/webUtils
      // (ADR 0112). Clipboard access goes through IPC (main/canvas/clipboard.ts).
      sandbox: true
    }
  })

  win.setMenuBarVisibility(false)
  win.on('ready-to-show', () => win.show())
  win.on('closed', () => unregisterWindow(win))
  win.on('focus', () => {
    lastFocusedWindow = win
  })
  attachCloseGuard(win)

  // The window must never show anything but the app's own page: a link in a
  // note or diagram would otherwise load a remote page in a window that has
  // `window.api` (file read/write over IPC) exposed. Links go to the user's
  // browser instead, and only for web/mail URLs (ADR 0112).
  win.webContents.setWindowOpenHandler((details) => {
    if (isSafeExternalUrl(details.url)) shell.openExternal(details.url)
    return { action: 'deny' }
  })
  win.webContents.on('will-navigate', (event, url) => {
    if (isSameDocument(url, win.webContents.getURL())) return
    event.preventDefault()
    if (isSafeExternalUrl(url)) shell.openExternal(url)
  })

  if (initialPath) {
    loadPathIntoWindow(win, initialPath)
  } else {
    const sessionId = newSessionId()
    if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
      win.loadURL(blankWindowUrl(process.env['ELECTRON_RENDERER_URL'], sessionId))
    } else {
      win.loadFile(join(__dirname, '../renderer/index.html'), { query: { session: sessionId } })
    }
  }

  return win
}

// A window that only shows a comparison of two versions of a diagram. It is not a document window:
// never registered under a path (opening the diagram must not focus it), no close guard (there is
// nothing to save), and the renderer never starts recovery for it because it never loads a diagram
// into the editor.
export function createCompareWindow(path: string, basePath: string): BrowserWindow {
  const win = new BrowserWindow({
    width: 1100,
    height: 760,
    show: false,
    ...(process.platform === 'linux' || (is.dev && process.platform !== 'darwin') ? { icon } : {}),
    webPreferences: { preload: join(__dirname, '../preload/index.js'), sandbox: true }
  })
  win.setMenuBarVisibility(false)
  win.on('ready-to-show', () => win.show())
  win.webContents.setWindowOpenHandler((details) => {
    if (isSafeExternalUrl(details.url)) shell.openExternal(details.url)
    return { action: 'deny' }
  })
  win.webContents.on('will-navigate', (event, url) => {
    if (isSameDocument(url, win.webContents.getURL())) return
    event.preventDefault()
    if (isSafeExternalUrl(url)) shell.openExternal(url)
  })
  const query = { compare: path, base: basePath }
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(`${process.env['ELECTRON_RENDERER_URL']}?${new URLSearchParams(query)}`)
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'), { query })
  }
  return win
}

// Focuses an existing window already showing this path; otherwise, if the calling window was passed
// in and is empty (nothing to lose; File -> Open and File -> Recent Diagrams both pass one),
// navigates it to the path; otherwise opens a new window. Drill-down link navigation
// (windows:openLinked) never passes a reuse candidate: a linked child always opens in its own
// window (ADR 0023). Only top-level "open a diagram" entry points reuse an empty window.
function openOrFocusWindow(path: string, reuseWindow?: BrowserWindow): BrowserWindow {
  const existing = findWindowForPath(path)
  if (existing) {
    if (existing.isMinimized()) existing.restore()
    existing.focus()
    return existing
  }
  if (reuseWindow) {
    loadPathIntoWindow(reuseWindow, path)
    return reuseWindow
  }
  return createWindow(path)
}

// Files handed to the app from outside — a double-click in the file manager
// (launch arguments, second-instance, macOS open-file; ADR 0108). Each gets
// its own window, or focuses the one already showing it; an empty window is
// never reused here because only the renderer knows whether one is empty.
// Returns the windows in order so a cold start can parent its recovery
// dialogs to the first.
export function openExternalPaths(paths: string[]): BrowserWindow[] {
  return paths.map((path) => {
    const win = openOrFocusWindow(path)
    // A just-created window shows itself on ready-to-show; follow that with a
    // focus so a file opened while the app was in the background comes forward.
    if (!win.isVisible()) win.once('ready-to-show', () => win.focus())
    return win
  })
}

// Launching the app again with no file (Start menu, dock): bring the window the
// user last had in front forward rather than starting a second process.
export function focusLastUsedWindow(): void {
  const win =
    lastFocusedWindow && !lastFocusedWindow.isDestroyed()
      ? lastFocusedWindow
      : BrowserWindow.getAllWindows()[0]
  if (!win) {
    createWindow()
    return
  }
  if (win.isMinimized()) win.restore()
  win.focus()
}

// Drop onto a window (ADR 0040, see docs/known-issues.md). Only the drop target window's state is
// in question, so this applies to the first of possibly several dropped files; the rest go through
// the ordinary openOrFocusWindow above.
//
// Empty: reuse directly, same "nothing to lose" reasoning as File -> Open. Non-empty: every button
// label states its own consequence (no bare "Open Here", which is misleading), every branch has a
// real Cancel, and the message states the window's dirty state outright instead of leaving it to be
// inferred from which buttons appear. Dirty adds a Save option, matching the close prompt's
// Save/Discard/Cancel shape (discard alone would be asymmetric). "Save changes, Open Here" hands
// off to the renderer's save flow via window:performSaveThenOpenDropped, since main can't save
// (path-picking and detail-draft flushing live in Canvas.tsx). "Discard changes, Open Here" first
// removes any pending recovery snapshot for the old identity, like the close prompt's Discard, so a
// stale orphan isn't offered back by a later startup scan.
async function openDroppedFileForWindow(
  path: string,
  callingWindow: BrowserWindow,
  callingWindowEmpty: boolean,
  callingWindowDirty: boolean,
  callingWindowPath: string | null,
  callingWindowSessionId: string
): Promise<void> {
  const existing = findWindowForPath(path)
  if (existing) {
    if (existing.isMinimized()) existing.restore()
    existing.focus()
    return
  }
  if (callingWindowEmpty) {
    loadPathIntoWindow(callingWindow, path)
    return
  }
  const name = basename(path)
  if (!callingWindowDirty) {
    const result = await dialog.showMessageBox(callingWindow, {
      type: 'question',
      buttons: ['Open Here', 'New Window', 'Cancel'],
      defaultId: 0,
      cancelId: 2,
      title: 'Open dropped file',
      message: `This window's diagram has no unsaved changes. Open "${name}" here, or in a new window?`
    })
    if (result.response === 0) loadPathIntoWindow(callingWindow, path)
    else if (result.response === 1) createWindow(path)
    return
  }
  const result = await dialog.showMessageBox(callingWindow, {
    type: 'question',
    buttons: ['Save changes, Open Here', 'Discard changes, Open Here', 'New Window', 'Cancel'],
    defaultId: 0,
    cancelId: 3,
    title: 'Unsaved changes',
    message: `This window has unsaved changes. Open "${name}" here after saving or discarding, or open it in a new window instead?`
  })
  if (result.response === 0) {
    callingWindow.webContents.send('window:performSaveThenOpenDropped', path)
  } else if (result.response === 1) {
    await deleteRecoverySnapshot(callingWindowPath, callingWindowSessionId)
    loadPathIntoWindow(callingWindow, path)
  } else if (result.response === 2) {
    createWindow(path)
  }
}

export function registerWindowHandlers(): void {
  ipcMain.handle('windows:openNew', () => {
    createWindow()
  })

  ipcMain.handle('windows:openCompare', (_event, path: string, basePath: string) => {
    createCompareWindow(path, basePath)
  })

  // callingWindowEmpty: the renderer's own nodes.length === 0 &&
  // edges.length === 0 check at the moment File -> Open was triggered —
  // if true, and the picked path isn't already open elsewhere, this
  // reuses the calling window instead of leaving a genuinely empty
  // window sitting around next to the newly-opened one.
  ipcMain.handle('windows:pickAndOpen', async (event, callingWindowEmpty: boolean) => {
    // defaultPath: a directory here, not a specific file — defaults to
    // wherever the user last opened/saved a diagram, if anywhere.
    // lastOpenedDirectory itself gets updated by diagram:openPath
    // once this pick actually results in a window loading a file, not
    // here — this handler only ever reads it.
    const prefs = await readPreferences()
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: FILTERS,
      title: 'Open diagram',
      defaultPath: prefs?.lastOpenedDirectory
    })
    if (result.canceled || result.filePaths.length === 0) return
    const callingWindow = callingWindowEmpty ? BrowserWindow.fromWebContents(event.sender) : null
    openOrFocusWindow(result.filePaths[0], callingWindow ?? undefined)
  })

  // Resolves a stored relative link path and opens/focuses a window for
  // it, without reading the diagram itself — the target window's own
  // mount effect does that. Returns found:false so the caller can show
  // the existing "linked diagram not found" alert (ADR 0005) — never a
  // silent failure.
  ipcMain.handle(
    'windows:openLinked',
    async (_event, diagramPath: string, relativePath: string) => {
      const resolvedPath = resolveLinkPath(diagramPath, relativePath)
      try {
        await access(resolvedPath)
      } catch {
        return { found: false as const, resolvedPath }
      }
      openOrFocusWindow(resolvedPath)
      return { found: true as const }
    }
  )

  // File -> Recent Diagrams -> (an entry). Absolute path, no dialog: opens or focuses a window like
  // a followed link, except that an empty calling window is reused, the same "nothing to lose" rule
  // as File -> Open (windows:pickAndOpen above) and drag-and-drop. If the path no longer exists, it
  // is pruned from the recent list and found:false is returned so the renderer can show a brief
  // "not found" notice; no stale entries linger and no per-menu-open filesystem check is needed.
  ipcMain.handle('windows:openRecent', async (event, path: string, callingWindowEmpty: boolean) => {
    try {
      await access(path)
    } catch {
      const prefs = await readPreferences()
      if (prefs?.recentDiagrams?.includes(path)) {
        await updatePreferences({
          recentDiagrams: prefs.recentDiagrams.filter((p) => p !== path)
        })
      }
      return { found: false as const }
    }
    const callingWindow = callingWindowEmpty ? BrowserWindow.fromWebContents(event.sender) : null
    openOrFocusWindow(path, callingWindow ?? undefined)
    return { found: true as const }
  })

  // Drag-and-drop a .chd onto a window — paths are already
  // filtered to .chd and resolved to real filesystem paths by the
  // renderer (webUtils.getPathForFile, only available in preload/
  // renderer context). Only the first path competes for this window;
  // every other dropped file always opens its own new window (or
  // focuses an existing one), same as the rest of this file's reuse
  // rules never applying to more than one window at a time.
  ipcMain.handle(
    'windows:handleDroppedFiles',
    async (
      event,
      paths: string[],
      callingWindowEmpty: boolean,
      callingWindowDirty: boolean,
      callingWindowPath: string | null,
      callingWindowSessionId: string
    ) => {
      const callingWindow = BrowserWindow.fromWebContents(event.sender)
      if (!callingWindow || paths.length === 0) return
      const [first, ...rest] = paths
      await openDroppedFileForWindow(
        first,
        callingWindow,
        callingWindowEmpty,
        callingWindowDirty,
        callingWindowPath,
        callingWindowSessionId
      )
      for (const path of rest) openOrFocusWindow(path)
    }
  )

  // Completes the "Save changes, Open Here" branch above once the renderer's own
  // save flow has actually finished (window:performSaveThenOpenDropped ->
  // this) — main can't perform the save itself, but once it's done, the
  // actual navigation is exactly the same loadPathIntoWindow every other
  // branch already uses.
  ipcMain.handle('windows:confirmSavedThenOpen', (event, path: string) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (win) loadPathIntoWindow(win, path)
  })

  // File -> Close resets this window's content back to blank
  // in-place, without a page navigation — so it never goes through
  // loadPathIntoWindow/registerWindowPath again the way every other path
  // change does. Without this, the window stayed registered as "showing"
  // its old path after being closed, so reopening that same file just
  // focused the (now blank) window instead of reloading it.
  ipcMain.handle('windows:clearPath', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (win) unregisterWindow(win)
  })

  // Close-prompt choreography (ADR 0040): the "how to save" logic (flush drafts, pick a path if
  // none) stays in the renderer's save flow; main only shows the native three-button dialog and,
  // once the close is approved, removes the recovery file and lets the window close. `detail` (ADR
  // 0102) is a one-line change count computed in the renderer by the diff engine the Changes panel
  // uses; main only forwards it into the dialog (main owns dialog mechanics, the renderer owns what
  // to compute). Absent or empty means no detail line, e.g. a never-saved diagram with nothing to
  // summarize.
  ipcMain.handle('windows:requestCloseDecision', async (event, detail?: string) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    const options = {
      type: 'question' as const,
      buttons: ['Save', 'Discard', 'Cancel'],
      defaultId: 0,
      cancelId: 2,
      title: 'Unsaved changes',
      message: 'Save changes before closing this window?',
      ...(detail ? { detail } : {})
    }
    const result = win
      ? await dialog.showMessageBox(win, options)
      : await dialog.showMessageBox(options)
    return (['save', 'discard', 'cancel'] as const)[result.response]
  })

  ipcMain.handle('windows:closeApproved', async (event, path: string | null, sessionId: string) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    await deleteRecoverySnapshot(path, sessionId)
    if (win) {
      closeApproved.add(win)
      win.close()
    }
  })
}
