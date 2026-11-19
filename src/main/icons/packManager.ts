import { app, BrowserWindow, dialog, ipcMain, shell, type IpcMainInvokeEvent } from 'electron'
import { randomUUID } from 'crypto'
import { mkdir, readFile, rm, stat, writeFile } from 'fs/promises'
import { basename, join } from 'path'
import { is } from '@electron-toolkit/utils'
import icon from '../../../resources/icon.png?asset'
import type {
  AddIconResult,
  InstalledIconResult,
  InstallProgress,
  InstallResult,
  PackList,
  RemoveResult
} from '@shared/icons/installedPacks'
import { TABLER_PACK } from '@shared/icons/iconRefs'
import { isSafeExternalUrl, isSameDocument } from '../navigationGuard'
import { installPack, listPacks, packFoldersByName, readPackIcon, removePack } from './packStore'
import { addMiscIcon, iconSvgFromFile } from './miscIcon'
import { stageTablerPack, tablerPackageFolder } from './tablerPack'

// The icon pack manager (ADR 0188): the one place packs are installed, updated and removed. Its own
// window with its own small bridge (src/preload/iconPacks.ts); the editor windows can open it and
// read the list, and cannot change a pack.

// Packs are per user and per machine, next to the saved preferences, never in the install folder.
export function iconPacksFolder(): string {
  return join(app.getPath('userData'), 'icon-packs')
}

// A chosen file bigger than this is not read: a PNG grows by a third once written into an SVG.
const MAX_PICKED_ICON_BYTES = 2_000_000

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

// Pack name -> folder, kept for a few seconds: a diagram with many installed icons asks once for each.
// Dropped when a pack is installed or removed and when the manager lists the packs.
const NAME_CACHE_MS = 5000
let names: { at: number; byName: Promise<Map<string, string>> } | null = null

function folderOf(pack: string): Promise<string | undefined> {
  if (!names || Date.now() - names.at > NAME_CACHE_MS) {
    names = { at: Date.now(), byName: packFoldersByName(iconPacksFolder()) }
  }
  return names.byName.then((byName) => byName.get(pack))
}

function announceChange(): void {
  names = null
  for (const win of BrowserWindow.getAllWindows()) win.webContents.send('iconPacks:changed')
}

// Only the manager window changes packs, whatever another window sends.
function fromManager(event: IpcMainInvokeEvent): BrowserWindow | null {
  return managerWindow && !managerWindow.isDestroyed() && event.sender === managerWindow.webContents
    ? managerWindow
    : null
}

// Runs one install at a time and tells the manager how far it is. `prepare` gives the folder to
// install, and a function that removes what it made once the install is over.
async function runInstall(
  win: BrowserWindow,
  prepare: (progress: (progress: InstallProgress) => void) => Promise<{
    source: string
    cleanUp?: () => Promise<void>
  }>
): Promise<InstallResult> {
  const job = { cancelled: false }
  running = job
  const send = (progress: InstallProgress): void => {
    if (!win.isDestroyed()) win.webContents.send('iconPacks:progress', progress)
  }
  let cleanUp: (() => Promise<void>) | undefined
  try {
    const prepared = await prepare(send)
    cleanUp = prepared.cleanUp
    const result = await installPack(iconPacksFolder(), prepared.source, {
      onProgress: send,
      isCancelled: () => job.cancelled
    })
    if (result.status === 'installed') announceChange()
    return ended(win, result)
  } catch (error) {
    return ended(win, {
      status: 'failed',
      message: error instanceof Error ? error.message : String(error)
    })
  } finally {
    running = null
    await cleanUp?.().catch(() => undefined)
  }
}

// An install the app started itself has no caller waiting for its answer, so the manager is told.
function ended(win: BrowserWindow, result: InstallResult): InstallResult {
  if (!win.isDestroyed()) win.webContents.send('iconPacks:installEnded', result)
  return result
}

// The Tabler pack, written out from the package that comes with the app into a temporary folder.
async function stagedTabler(
  progress: (progress: InstallProgress) => void
): Promise<{ source: string; cleanUp: () => Promise<void> }> {
  progress({ phase: 'reading', done: 0, total: 0 })
  const parent = join(app.getPath('temp'), `chd-tabler-${randomUUID()}`)
  const cleanUp = (): Promise<void> => rm(parent, { recursive: true, force: true })
  try {
    const staged = await stageTablerPack(tablerPackageFolder(app.getAppPath()), parent)
    return { source: staged.folder, cleanUp }
  } catch (error) {
    await cleanUp().catch(() => undefined)
    throw error
  }
}

// The first-start question (ADR 0188): offer the Tabler pack once. Either answer is remembered by a
// file in the packs folder, so the question is not asked again, and deleting the folder resets it.
// It is asked as a banner inside the window that was opened, not as a box in front of it, so the
// window is visible whether or not anyone answers (ADR 0192).
const OFFERED_FILE = '.offered'

// The window that has been shown the question and has not answered. Only its answer counts.
let pendingOffer: BrowserWindow | null = null

export async function offerDefaultPacks(win: BrowserWindow): Promise<void> {
  // A launch for automated driving has nobody to answer the question.
  if (app.commandLine.hasSwitch('remote-debugging-port')) return
  const folder = iconPacksFolder()
  const asked = await readFile(join(folder, OFFERED_FILE), 'utf-8').then(
    () => true,
    () => false
  )
  if (asked || win.isDestroyed()) return
  const installed = (await listPacks(folder).catch(() => [])).some(
    (pack) => pack.meta.name === TABLER_PACK && pack.duplicateOf === null
  )
  if (installed) return
  pendingOffer = win
  win.webContents.send('iconPacks:offer')
}

// The answer of the window that was asked. "Install" opens the manager and installs the bundled
// Tabler pack there; either answer is remembered.
async function answerOffer(event: IpcMainInvokeEvent, accept: unknown): Promise<void> {
  const win = pendingOffer
  if (!win || win.isDestroyed() || event.sender !== win.webContents) return
  pendingOffer = null
  const folder = iconPacksFolder()
  await mkdir(folder, { recursive: true })
  await writeFile(join(folder, OFFERED_FILE), '', 'utf-8')
  if (accept !== true || running) return
  openManager()
  const manager = managerWindow
  if (!manager || manager.isDestroyed()) return
  await runInstall(manager, stagedTabler)
}

export function registerIconPackHandlers(): void {
  ipcMain.handle('iconPacks:open', () => openManager())
  ipcMain.handle('iconPacks:answerOffer', answerOffer)

  // One icon of a pack, by the pack's name and the path a diagram stores. Any window may read.
  ipcMain.handle(
    'iconPacks:readIcon',
    async (_event, pack: unknown, path: unknown): Promise<InstalledIconResult> => {
      if (typeof pack !== 'string') return { ok: false, reason: 'refused' }
      const folder = await folderOf(pack)
      if (folder === undefined) return { ok: false, reason: 'no-pack' }
      return readPackIcon(iconPacksFolder(), folder, path)
    }
  )

  // Adds one icon the person chooses to the Misc icons pack. The editor window sends nothing: the
  // file comes from a native dialog, and it can only ever be written into that one pack.
  ipcMain.handle('iconPacks:addMisc', async (event): Promise<AddIconResult> => {
    const parent = BrowserWindow.fromWebContents(event.sender) ?? undefined
    const options = {
      title: 'Choose an icon',
      properties: ['openFile' as const],
      filters: [{ name: 'Icon', extensions: ['svg', 'png'] }]
    }
    const picked = parent
      ? await dialog.showOpenDialog(parent, options)
      : await dialog.showOpenDialog(options)
    if (picked.canceled || picked.filePaths.length === 0) return { status: 'cancelled' }
    const file = picked.filePaths[0]
    try {
      if ((await stat(file)).size > MAX_PICKED_ICON_BYTES) {
        return { status: 'failed', message: `${basename(file)} is larger than an icon may be.` }
      }
      const svg = iconSvgFromFile(basename(file), await readFile(file))
      if (!svg.ok) return { status: 'failed', message: svg.message }
      const result = await addMiscIcon(iconPacksFolder(), basename(file), svg.svg)
      if (result.status === 'added') announceChange()
      return result
    } catch (error) {
      return { status: 'failed', message: error instanceof Error ? error.message : String(error) }
    }
  })

  ipcMain.handle('iconPacks:list', async (): Promise<PackList> => {
    names = null
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
    return runInstall(win, () => Promise.resolve({ source: picked.filePaths[0] }))
  })

  ipcMain.handle('iconPacks:installTabler', async (event): Promise<InstallResult> => {
    const win = fromManager(event)
    if (!win) return { status: 'failed', message: 'Packs are installed in the icon pack manager.' }
    if (running) return { status: 'failed', message: 'An install is already running.' }
    return runInstall(win, stagedTabler)
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
