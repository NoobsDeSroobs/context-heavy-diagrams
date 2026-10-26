import { BrowserWindow, ipcMain, shell } from 'electron'
import { randomUUID } from 'crypto'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import icon from '../../../resources/icon.png?asset'
import { parseDiagram, type DiagramFile } from '@shared/diagram'
import type { CompareSession } from '@shared/compare/session'
import { isSafeExternalUrl, isSameDocument } from '../navigationGuard'

// The versions each open compare window shows, by the id in its URL. Dropped when it closes.
const sessions = new Map<string, CompareSession>()

// A window that only shows a comparison of two versions of a diagram. It is not a document window:
// never registered under a path (opening the diagram must not focus it), no close guard (there is
// nothing to save), and it never mounts the editor, so no recovery or autosave starts for it.
function createCompareWindow(session: CompareSession): BrowserWindow {
  const id = randomUUID()
  sessions.set(id, session)
  const win = new BrowserWindow({
    width: 1100,
    height: 760,
    show: false,
    title: session.title,
    ...(process.platform === 'linux' || (is.dev && process.platform !== 'darwin') ? { icon } : {}),
    webPreferences: { preload: join(__dirname, '../preload/index.js'), sandbox: true }
  })
  win.setMenuBarVisibility(false)
  win.on('ready-to-show', () => win.show())
  win.on('closed', () => sessions.delete(id))
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
    win.loadURL(`${process.env['ELECTRON_RENDERER_URL']}?${new URLSearchParams({ compare: id })}`)
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'), { query: { compare: id } })
  }
  return win
}

// Both versions are checked like any diagram read from disk, so a malformed one is refused here
// instead of reaching the renderer's drawing code.
function asDiagram(value: unknown): DiagramFile {
  return parseDiagram(JSON.stringify(value))
}

function readSession(raw: unknown): CompareSession {
  const value = raw as Partial<CompareSession> | null
  if (!value || typeof value !== 'object') throw new Error('Not a compare session')
  if (typeof value.title !== 'string') throw new Error('A compare session needs a title')
  if (value.diagramPath !== null && typeof value.diagramPath !== 'string') {
    throw new Error('A compare session needs a diagram path or null')
  }
  return {
    base: asDiagram(value.base),
    next: asDiagram(value.next),
    diagramPath: value.diagramPath,
    title: value.title
  }
}

export function registerCompareHandlers(): void {
  ipcMain.handle('compare:open', (_event, raw: unknown) => {
    createCompareWindow(readSession(raw))
  })
  ipcMain.handle('compare:getSession', (_event, id: string): CompareSession | null => {
    return sessions.get(id) ?? null
  })
}
