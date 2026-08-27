import { BrowserWindow, dialog, ipcMain, shell } from 'electron'
import { access } from 'fs/promises'
import { basename, dirname, isAbsolute, join } from 'path'
import { is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { deleteRecoverySnapshot, newSessionId } from './recovery'
import { readAppSettings } from './appSettings'

const FILTERS = [{ name: 'Diagram', extensions: ['chd'] }]

// One BrowserWindow per open diagram (ADR 0023) — this registry lets
// opening a diagram already open elsewhere focus that window instead of
// opening a second one on the same file, which would be a silent-overwrite
// risk with no dirty-tracking yet (see ADR 0040). Keyed by normalized
// absolute path.
const windowsByPath = new Map<string, BrowserWindow>()

function normalizePath(path: string): string {
  return process.platform === 'win32' ? path.toLowerCase() : path
}

function unregisterWindow(win: BrowserWindow): void {
  for (const [key, existing] of windowsByPath) {
    if (existing === win) windowsByPath.delete(key)
  }
}

// Exported for diagram.ts's save handler — a window's path is only known
// once it's saved for the first time (or opened with one already known).
// Clears this window's own previous entry first — a window can only ever
// legitimately show one path at a time, but the underlying Map is keyed
// by path, not by window, so nothing enforced that on its own. Before
// drag-to-open, a window's path only ever changed once in its lifetime (at
// creation, or via File -> Open's reuse-if-empty, itself only usable
// once), so the gap never showed up. Drag-to-open navigates the same
// (non-empty) window to a new path repeatedly across several drops,
// which exposed it: dropping file2 "Open Here" onto a window already
// showing file1 left BOTH `file1 -> win` and `file2 -> win` in the map,
// so dropping file1 again just found the stale entry and focused the
// (already-focused) window instead of loading it — live-testing catch.
export function registerWindowPath(win: BrowserWindow, path: string): void {
  unregisterWindow(win)
  windowsByPath.set(normalizePath(path), win)
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
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  win.on('ready-to-show', () => win.show())
  win.on('closed', () => unregisterWindow(win))
  attachCloseGuard(win)

  win.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
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

// Drop-onto-a-window (ADR 0040's own design pass, 2026-08-22,
// revised same-day after live testing — see docs/known-issues.md) — only
// the drop *target* window's own state is ever in question, so this only
// applies to the first of possibly several dropped files; every other
// file just goes through the ordinary openOrFocusWindow above.
//
// Empty: reuse directly, same "nothing to lose" reasoning as File -> Open.
// Non-empty: every button label states its own consequence explicitly
// (no bare "Open Here" — the first live-testing pass found that
// misleading), every branch has a real Cancel, and the message states the
// window's dirty state outright rather than leaving it for the user to
// infer from which button set happened to show up. Dirty adds a genuine
// Save option, matching the close-prompt's own Save/Discard/Cancel shape
// (the first pass only had discard, an asymmetry the user flagged) —
// "Save changes, Open Here" hands off to the renderer's own save flow via
// window:performSaveThenOpenDropped, since main can't perform a save
// itself (path-picking, detail-draft flushing all live in Canvas.tsx).
// "Discard changes, Open Here" cleans up any pending recovery snapshot
// for the old identity first (mirrors the close-prompt's own Discard), so
// a stale orphan doesn't linger for a future startup scan to offer back.
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

  // callingWindowEmpty: the renderer's own nodes.length === 0 &&
  // edges.length === 0 check at the moment File -> Open was triggered —
  // if true, and the picked path isn't already open elsewhere, this
  // reuses the calling window instead of leaving a genuinely empty
  // window sitting around next to the newly-opened one.
  ipcMain.handle('windows:pickAndOpen', async (event, callingWindowEmpty: boolean) => {
    // defaultPath: a directory here, not a specific file — defaults to
    // wherever the user last opened/saved a diagram, if anywhere (epic
    // 0091). lastOpenedDirectory itself gets updated by diagram:openPath
    // once this pick actually results in a window loading a file, not
    // here — this handler only ever reads it.
    const settings = await readAppSettings()
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: FILTERS,
      title: 'Open diagram',
      defaultPath: settings?.lastOpenedDirectory
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
  // focused the (now blank) window instead of reloading it — a real bug
  // caught in live testing, not present in the original design.
  ipcMain.handle('windows:clearPath', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (win) unregisterWindow(win)
  })

  // Close-prompt choreography (see ADR 0040) — the complex "how to
  // actually save" logic (flush drafts, pick a path if none yet, etc.)
  // stays entirely in the renderer's existing save flow; main only shows
  // the native 3-button dialog and, once told the close is approved,
  // cleans up the recovery file and lets the window actually close.
  ipcMain.handle('windows:requestCloseDecision', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    const options = {
      type: 'question' as const,
      buttons: ['Save', 'Discard', 'Cancel'],
      defaultId: 0,
      cancelId: 2,
      title: 'Unsaved changes',
      message: 'Save changes before closing this window?'
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
