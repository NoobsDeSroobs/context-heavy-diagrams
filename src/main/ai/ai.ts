import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron'
import { existsSync } from 'fs'
import { dirname, join, sep } from 'path'
import type {
  AiFolderResult,
  ClaudeExtensionOutcome,
  McpSettingsResult
} from '../../shared/ai/aiFolderResult'
import { mcpServerSettings } from '../../shared/ai/mcpSettings'
import { readPreferences } from '../preferences/appPreferences'
import { installAiFiles } from './aiFolder'

// AI -> "Set up a folder for AI agents…" (ADR 0105). The OS folder picker is
// the user's consent: nothing is written anywhere they didn't just choose.
// app.getAppPath() is the project root in dev and app.asar when packaged;
// resources/ai/** ships in both (electron-builder.yml, asarUnpack: resources/**).
export function registerAiHandlers(): void {
  ipcMain.handle('ai:enableInFolder', async (event): Promise<AiFolderResult | null> => {
    const win = BrowserWindow.fromWebContents(event.sender)
    const options: Electron.OpenDialogOptions = {
      title: 'Choose the folder that contains your diagrams',
      defaultPath: (await readPreferences())?.lastOpenedDirectory,
      properties: ['openDirectory', 'createDirectory']
    }
    const picked = win
      ? await dialog.showOpenDialog(win, options)
      : await dialog.showOpenDialog(options)
    if (picked.canceled || picked.filePaths.length === 0) return null
    return installAiFiles(
      join(app.getAppPath(), 'resources', 'ai'),
      picked.filePaths[0],
      app.getVersion(),
      installedCliPath()
    )
  })

  ipcMain.handle('ai:installExtension', (event) =>
    installClaudeExtension(BrowserWindow.fromWebContents(event.sender))
  )

  ipcMain.handle('ai:mcpServerSettings', (event) =>
    chooseMcpSettings(BrowserWindow.fromWebContents(event.sender))
  )
}

// Files that ship unpacked beside the app (asarUnpack: resources/**), as a path a program started
// by another app can open: it cannot read inside app.asar.
function unpackedPath(...parts: string[]): string {
  return join(app.getAppPath(), ...parts).replace(`app.asar${sep}`, `app.asar.unpacked${sep}`)
}

// AI -> "Install the MCP server for -> Other apps…" (ADR 0110). The server is the one the Claude
// Desktop extension runs, started by `chd mcp`; this builds the settings that point an app at it.
async function chooseMcpSettings(win: BrowserWindow | null): Promise<McpSettingsResult> {
  // An AppImage runs from a mount that is new on every start, so no path to the app would hold.
  if (process.env.APPIMAGE) return { outcome: 'unsupported' }

  const showBox = (options: Electron.MessageBoxOptions): Promise<Electron.MessageBoxReturnValue> =>
    win ? dialog.showMessageBox(win, options) : dialog.showMessageBox(options)

  if (!existsSync(unpackedPath('resources', 'extension', 'server.mjs'))) {
    await showBox({
      type: 'error',
      title: 'MCP server',
      message: 'The MCP server is not part of this build.',
      detail: 'It is created by "npm run build:extension" (the normal build runs it).'
    })
    return { outcome: 'missing' }
  }

  const options: Electron.OpenDialogOptions = {
    title: 'Choose the one folder the assistant may use',
    defaultPath: (await readPreferences())?.lastOpenedDirectory,
    properties: ['openDirectory', 'createDirectory']
  }
  const picked = win
    ? await dialog.showOpenDialog(win, options)
    : await dialog.showOpenDialog(options)
  if (picked.canceled || picked.filePaths.length === 0) return { outcome: 'cancelled' }
  const folder = picked.filePaths[0]

  const choice = await showBox({
    type: 'question',
    title: 'MCP server',
    message: 'Make settings for an app that can use MCP servers?',
    detail:
      `The app will start the server from your computer and give it this folder:\n${folder}\n\n` +
      'The assistant can read everything in it and create new diagrams there. The server runs on ' +
      'your computer and makes no network connections. It also runs git (read only) to get the last ' +
      'committed version of a diagram when it is asked what changed. That version can contain things ' +
      'you have since deleted, and the assistant will see them. Whatever the assistant reads is sent ' +
      'to its provider as part of your conversation, so do not choose a folder with confidential ' +
      'material or history unless that is acceptable.',
    buttons: ['Copy the settings', 'Cancel'],
    defaultId: 0,
    cancelId: 1,
    checkboxLabel: 'Let the assistant change existing files (can cause data loss)',
    checkboxChecked: false
  })
  if (choice.response !== 0) return { outcome: 'cancelled' }

  const allowUpdate = choice.checkboxChecked
  return {
    outcome: 'ready',
    settings: mcpServerSettings({
      command: process.execPath,
      script: unpackedPath('resources', 'cli', 'chd.mjs'),
      folder,
      allowUpdate
    }),
    folder,
    allowUpdate
  }
}

// AI -> "Install Claude Desktop extension…" (ADR 0110). The extension is a
// build artifact (npm run build:extension) shipped under resources/; Claude
// Desktop, not this app, installs and runs it. Claude Desktop exists for
// Windows and macOS only.
const EXTENSION_FILE = join('resources', 'extension', 'context-heavy-diagrams.mcpb')

function bundledExtensionPath(): string {
  // The OS opens the file, and it cannot read inside app.asar: use the
  // unpacked copy (asarUnpack: resources/**).
  return join(app.getAppPath(), EXTENSION_FILE).replace(`app.asar${sep}`, `app.asar.unpacked${sep}`)
}

async function installClaudeExtension(win: BrowserWindow | null): Promise<ClaudeExtensionOutcome> {
  if (process.platform !== 'win32' && process.platform !== 'darwin') return 'unsupported'

  const file = bundledExtensionPath()
  if (!existsSync(file)) {
    const options: Electron.MessageBoxOptions = {
      type: 'error',
      title: 'Claude Desktop extension',
      message: 'The Claude Desktop extension is not part of this build.',
      detail: 'It is created by "npm run build:extension" (the normal build runs it).'
    }
    await (win ? dialog.showMessageBox(win, options) : dialog.showMessageBox(options))
    return 'missing'
  }

  const options: Electron.MessageBoxOptions = {
    type: 'question',
    title: 'Claude Desktop extension',
    message: 'Add your diagrams to Claude Desktop?',
    detail:
      'This opens an extension file in Claude Desktop, which will ask you to install it and to choose ' +
      'one folder with your diagrams and documents. Claude can read everything in that folder and create ' +
      'new diagrams there. A second option, off by default, lets Claude change existing files, which can ' +
      'cause data loss.\n\n' +
      'The extension runs on your computer and makes no network connections. It also runs git (read only) ' +
      'to get the last committed version of a diagram when Claude is asked what changed. That version can ' +
      'contain things you have since deleted, and Claude will see them. ' +
      'Whatever Claude reads is sent to Anthropic as part of your conversation, so do not choose a ' +
      'folder with confidential material or history unless that is acceptable.\n\n' +
      'If your computer asks which app should open the file, choose Claude. You can also drag the file ' +
      "onto Claude Desktop's Settings > Extensions page.",
    buttons: ['Open in Claude Desktop', 'Cancel'],
    defaultId: 0,
    cancelId: 1
  }
  const choice = await (win ? dialog.showMessageBox(win, options) : dialog.showMessageBox(options))
  if (choice.response !== 0) return 'cancelled'

  // openPath resolves to an empty string on success, an error message otherwise.
  if ((await shell.openPath(file)) === '') return 'opened'
  shell.showItemInFolder(file)
  return 'revealed'
}

// Where the `chd` launcher sits in an installed app (electron-builder extraFiles,
// ADR 0106). Undefined in dev (no launcher is built) and in an AppImage, whose
// exe lives in a temporary mount — a path written into AGENTS.md would rot.
function installedCliPath(): string | undefined {
  if (!app.isPackaged || process.env.APPIMAGE) return undefined
  const launcher = join(dirname(process.execPath), process.platform === 'win32' ? 'chd.cmd' : 'chd')
  return existsSync(launcher) ? launcher : undefined
}
