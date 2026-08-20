import { BrowserWindow, dialog, ipcMain, shell } from 'electron'
import { access } from 'fs/promises'
import { dirname, isAbsolute, join } from 'path'
import { is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'

const FILTERS = [{ name: 'Diagram', extensions: ['chd'] }]

// One BrowserWindow per open diagram (ADR 0023) — this registry lets
// opening a diagram already open elsewhere focus that window instead of
// opening a second one on the same file, which would be a silent-overwrite
// risk with no dirty-tracking yet (epic 0020). Keyed by normalized
// absolute path.
const windowsByPath = new Map<string, BrowserWindow>()

function normalizePath(path: string): string {
  return process.platform === 'win32' ? path.toLowerCase() : path
}

// Exported for diagram.ts's save handler — a window's path is only known
// once it's saved for the first time (or opened with one already known).
export function registerWindowPath(win: BrowserWindow, path: string): void {
  windowsByPath.set(normalizePath(path), win)
}

function unregisterWindow(win: BrowserWindow): void {
  for (const [key, existing] of windowsByPath) {
    if (existing === win) windowsByPath.delete(key)
  }
}

function findWindowForPath(path: string): BrowserWindow | undefined {
  return windowsByPath.get(normalizePath(path))
}

// A relativePath stored on a node can legitimately resolve to an absolute
// path (path.relative() falls back to absolute across Windows drives) — a
// bare path.join() would silently mangle that instead of erroring, so this
// must be checked explicitly rather than always joining.
function resolveLinkPath(diagramPath: string, relativePath: string): string {
  return isAbsolute(relativePath) ? relativePath : join(dirname(diagramPath), relativePath)
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

// initialPath, when given, is passed to the renderer via a ?path= query
// string rather than read here — the new window's own mount effect loads
// it through the existing diagram:openPath IPC, reusing tested code
// instead of duplicating file-read logic in main.
export function createWindow(initialPath?: string): BrowserWindow {
  const win = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  win.on('ready-to-show', () => win.show())
  win.on('closed', () => unregisterWindow(win))

  win.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (initialPath) {
    loadPathIntoWindow(win, initialPath)
  } else if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return win
}

// Focuses an existing window already showing this path; otherwise, if the
// calling window was passed in and is currently empty (File -> Open with
// nothing to lose in the window you're opening from — see the comment at
// its call site), navigates that window to the path instead of opening a
// new one; otherwise opens a brand new window. Both link-navigation flows
// (create new / follow existing) never pass a reuse candidate — they
// always open the target in its own window, never in-place (ADR 0023).
function openOrFocusWindow(path: string, reuseWindow?: BrowserWindow): void {
  const existing = findWindowForPath(path)
  if (existing) {
    if (existing.isMinimized()) existing.restore()
    existing.focus()
    return
  }
  if (reuseWindow) {
    loadPathIntoWindow(reuseWindow, path)
    return
  }
  createWindow(path)
}

export function registerWindowHandlers(): void {
  ipcMain.handle('windows:openNew', () => {
    createWindow()
  })

  // callingWindowEmpty: the renderer's own nodes.length === 0 &&
  // edges.length === 0 check at the moment File -> Open was triggered —
  // if true, and the picked path isn't already open elsewhere, this
  // reuses the calling window instead of leaving a genuinely empty
  // window sitting around next to the newly-opened one.
  ipcMain.handle('windows:pickAndOpen', async (event, callingWindowEmpty: boolean) => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: FILTERS,
      title: 'Open diagram'
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
}
