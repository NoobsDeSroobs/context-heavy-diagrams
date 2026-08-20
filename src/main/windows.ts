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

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    const query = initialPath ? `?path=${encodeURIComponent(initialPath)}` : ''
    win.loadURL(process.env['ELECTRON_RENDERER_URL'] + query)
  } else {
    win.loadFile(
      join(__dirname, '../renderer/index.html'),
      initialPath ? { query: { path: initialPath } } : undefined
    )
  }

  if (initialPath) registerWindowPath(win, initialPath)

  return win
}

// Focuses an existing window already showing this path, or opens a new
// one — used by File -> Open and by both link-navigation flows (create
// new / follow existing both open the target in its own window, never
// in-place; ADR 0023).
function openOrFocusWindow(path: string): void {
  const existing = findWindowForPath(path)
  if (existing) {
    if (existing.isMinimized()) existing.restore()
    existing.focus()
    return
  }
  createWindow(path)
}

export function registerWindowHandlers(): void {
  ipcMain.handle('windows:openNew', () => {
    createWindow()
  })

  ipcMain.handle('windows:pickAndOpen', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: FILTERS,
      title: 'Open diagram'
    })
    if (result.canceled || result.filePaths.length === 0) return
    openOrFocusWindow(result.filePaths[0])
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
