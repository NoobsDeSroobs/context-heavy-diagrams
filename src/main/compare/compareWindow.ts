import { BrowserWindow, ipcMain, shell } from 'electron'
import { randomUUID } from 'crypto'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import icon from '../../../resources/icon.png?asset'
import { parseDiagram, type DiagramFile } from '@shared/diagram'
import type { CompareSession } from '@shared/compare/session'
import { applyIdMatches } from '@shared/compare/match'
import {
  REVERT_CHANGES,
  REVERT_KINDS,
  type RevertChange,
  type RevertIdMatches,
  type RevertKind,
  type RevertRequest,
  type RevertResult
} from '@shared/compare/revert'
import { isSafeExternalUrl, isSameDocument } from '../navigationGuard'
import { findWindowForPath } from '../windows'
import { buildGitSession } from './gitCompare'

// The versions each open compare window shows, by the id in its URL. Dropped when it closes.
const sessions = new Map<string, CompareSession>()

// Reverts sent to an editor window and not yet answered, by request id.
const pendingReverts = new Map<string, (result: RevertResult) => void>()
const REVERT_TIMEOUT_MS = 10_000

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
    // Its own, smaller bridge (src/preload/compare.ts): this window never writes anything.
    webPreferences: { preload: join(__dirname, '../preload/compare.js'), sandbox: true }
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

function isStringRecord(value: unknown): value is Record<string, string> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.values(value).every((v) => typeof v === 'string')
  )
}

// The matched ids a revert carries: none, or a checked pair of records.
function readMatches(raw: unknown): RevertIdMatches | undefined | 'invalid' {
  if (raw === undefined || raw === null) return undefined
  const value = raw as Partial<RevertIdMatches>
  if (!isStringRecord(value.nodes) || !isStringRecord(value.edges)) return 'invalid'
  return { nodes: value.nodes, edges: value.edges }
}

export function registerCompareHandlers(): void {
  ipcMain.handle('compare:open', (_event, raw: unknown) => {
    createCompareWindow(readSession(raw))
  })
  // The file on disk against the same file at a git revision. The answer says why it could not be
  // done, in words for the person who asked, instead of throwing.
  ipcMain.handle(
    'compare:openGit',
    async (
      _event,
      diagramPath: unknown,
      revision: unknown
    ): Promise<{ ok: boolean; message?: string }> => {
      if (typeof diagramPath !== 'string' || typeof revision !== 'string') {
        return { ok: false, message: 'Not a diagram and a revision.' }
      }
      const result = await buildGitSession(diagramPath, revision.trim())
      if (!result.ok) return { ok: false, message: result.message }
      createCompareWindow(result.session)
      return { ok: true }
    }
  )
  ipcMain.handle('compare:getSession', (_event, id: string): CompareSession | null => {
    return sessions.get(id) ?? null
  })

  // Put one element back as the earlier version has it. The compare window never changes a
  // diagram: this goes to the editor window showing the same file, which does it as one undoable
  // edit and answers. Without such a window there is nothing to revert in.
  ipcMain.handle(
    'compare:revert',
    (
      _event,
      sessionId: unknown,
      kind: unknown,
      id: unknown,
      change: unknown,
      matches: unknown
    ): Promise<RevertResult> => {
      const session = typeof sessionId === 'string' ? sessions.get(sessionId) : undefined
      if (
        !session ||
        typeof id !== 'string' ||
        typeof kind !== 'string' ||
        !REVERT_KINDS.includes(kind) ||
        typeof change !== 'string' ||
        !REVERT_CHANGES.includes(change)
      ) {
        return Promise.resolve({ ok: false, message: 'This comparison is no longer available.' })
      }
      if (session.diagramPath === null) {
        return Promise.resolve({ ok: false, message: 'This diagram has never been saved.' })
      }
      const editor = findWindowForPath(session.diagramPath)
      if (!editor || editor.isDestroyed()) {
        return Promise.resolve({
          ok: false,
          message: 'Open this diagram in the editor first: a revert is made there.'
        })
      }
      const pairs = readMatches(matches)
      if (pairs === 'invalid') {
        return Promise.resolve({ ok: false, message: 'The matched elements are not readable.' })
      }
      const requestId = randomUUID()
      const request: RevertRequest = {
        requestId,
        // The earlier version as the reviewer sees it: matched elements carry the later ids.
        base: pairs
          ? applyIdMatches(session.base, {
              nodes: new Map(Object.entries(pairs.nodes)),
              edges: new Map(Object.entries(pairs.edges))
            })
          : session.base,
        kind: kind as RevertKind,
        id,
        change: change as RevertChange
      }
      return new Promise<RevertResult>((resolve) => {
        const timer = setTimeout(() => {
          pendingReverts.delete(requestId)
          resolve({ ok: false, message: 'The editor window did not answer.' })
        }, REVERT_TIMEOUT_MS)
        pendingReverts.set(requestId, (result) => {
          clearTimeout(timer)
          resolve(result)
        })
        editor.webContents.send('compare:revertRequest', request)
      })
    }
  )
  ipcMain.handle('compare:revertResult', (_event, requestId: unknown, result: RevertResult) => {
    if (typeof requestId !== 'string') return
    const answer = pendingReverts.get(requestId)
    pendingReverts.delete(requestId)
    answer?.({ ok: result?.ok === true, message: result?.message })
  })
}
