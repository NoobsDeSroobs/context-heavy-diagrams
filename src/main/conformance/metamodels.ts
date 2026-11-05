import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron'
import { existsSync } from 'fs'
import { mkdir, readdir, readFile, writeFile } from 'fs/promises'
import { basename, join } from 'path'
import { METAMODEL_FILE_SUFFIX, metamodelFileBase } from '@shared/conformance/metamodel'
import {
  newMetamodelText,
  metamodelNameFromPath,
  withMetamodelSuffix
} from '@shared/conformance/newMetamodel'
import type {
  NewMetamodelResult,
  MetamodelListing,
  MetamodelsFolderInfo
} from '@shared/conformance/metamodelsFolder'
import { readPreferences, updatePreferences } from '../preferences/appPreferences'

// The user's diagram metamodels (ADR 0131): a folder (a Preferences setting, by default
// `metamodels` in the user-data folder) and "New metamodel", which copies the shipped template there.
// The OS dialogs are the user's consent: nothing is written anywhere they did not just choose.

async function folderInfo(): Promise<MetamodelsFolderInfo> {
  const chosen = (await readPreferences())?.metamodelsFolder
  if (chosen) return { folder: chosen, isDefault: false }
  const folder = join(app.getPath('userData'), 'metamodels')
  // Before the rename the default folder was called `profiles`; keep using it while it is the one
  // with the person's files in it.
  const old = join(app.getPath('userData'), 'profiles')
  if (!existsSync(folder) && existsSync(old)) return { folder: old, isDefault: true }
  return { folder, isDefault: true }
}

// resources/metamodels/** ships in dev and packaged (asarUnpack: resources/**); the template is read
// with Electron's asar-aware fs either way.
function templatePath(): string {
  return join(app.getAppPath(), 'resources', 'metamodels', `template${METAMODEL_FILE_SUFFIX}`)
}

const builtInDir = (): string => join(app.getAppPath(), 'resources', 'metamodels')
const TEMPLATE = `template${METAMODEL_FILE_SUFFIX}`

async function metamodelFiles(dir: string): Promise<string[]> {
  try {
    return (await readdir(dir)).filter((f) => metamodelFileBase(f) !== null).sort()
  } catch {
    return []
  }
}

const nameOf = (file: string): string => metamodelFileBase(file) ?? file

// The path behind a listing id, only ever inside the built-in folder or the metamodels folder.
async function pathForId(id: string): Promise<string | null> {
  const [source, file] = [id.slice(0, id.indexOf(':')), id.slice(id.indexOf(':') + 1)]
  if (!file || file !== basename(file) || metamodelFileBase(file) === null) return null
  if (source === 'builtin') return join(builtInDir(), file)
  if (source === 'folder') return join((await folderInfo()).folder, file)
  return null
}

export function registerMetamodelHandlers(): void {
  ipcMain.handle('metamodels:getFolder', () => folderInfo())

  // What the Diagnostics panel offers: the built-in metamodels, then the ones in the metamodels folder.
  ipcMain.handle('metamodels:list', async (): Promise<MetamodelListing[]> => {
    const builtIn = (await metamodelFiles(builtInDir())).filter((f) => f !== TEMPLATE)
    const own = await metamodelFiles((await folderInfo()).folder)
    return [
      ...builtIn.map((f) => ({ id: `builtin:${f}`, name: nameOf(f), source: 'built-in' as const })),
      ...own.map((f) => ({ id: `folder:${f}`, name: nameOf(f), source: 'folder' as const }))
    ]
  })

  // The text of one listed metamodel, read fresh each time so an edit shows on the next refresh.
  ipcMain.handle('metamodels:load', async (_event, id: string): Promise<string | null> => {
    const path = await pathForId(String(id))
    if (!path) return null
    try {
      return await readFile(path, 'utf-8')
    } catch {
      return null
    }
  })

  ipcMain.handle('metamodels:chooseFolder', async (event): Promise<string | null> => {
    const win = BrowserWindow.fromWebContents(event.sender)
    const options: Electron.OpenDialogOptions = {
      title: 'Choose the folder for your diagram metamodels',
      defaultPath: (await folderInfo()).folder,
      properties: ['openDirectory', 'createDirectory']
    }
    const picked = win
      ? await dialog.showOpenDialog(win, options)
      : await dialog.showOpenDialog(options)
    if (picked.canceled || picked.filePaths.length === 0) return null
    await updatePreferences({ metamodelsFolder: picked.filePaths[0] })
    return picked.filePaths[0]
  })

  // The file name picked in the save dialog is the metamodel's name. Never overwrites: the file is
  // created or the call reports that it exists (the same rule as every other writer, ADR 0109).
  ipcMain.handle('metamodels:create', async (event): Promise<NewMetamodelResult> => {
    const win = BrowserWindow.fromWebContents(event.sender)
    const { folder } = await folderInfo()
    await mkdir(folder, { recursive: true })
    const options: Electron.SaveDialogOptions = {
      title: 'New diagram metamodel',
      defaultPath: join(folder, `my-metamodel${METAMODEL_FILE_SUFFIX}`),
      buttonLabel: 'Create',
      filters: [{ name: 'Diagram metamodel', extensions: [METAMODEL_FILE_SUFFIX.slice(1)] }]
    }
    const picked = win
      ? await dialog.showSaveDialog(win, options)
      : await dialog.showSaveDialog(options)
    if (picked.canceled || !picked.filePath) return { status: 'cancelled' }

    const path = withMetamodelSuffix(picked.filePath)
    const text = newMetamodelText(
      await readFile(templatePath(), 'utf-8'),
      metamodelNameFromPath(path)
    )
    try {
      await writeFile(path, text, { encoding: 'utf-8', flag: 'wx' })
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'EEXIST') return { status: 'exists', path }
      throw error
    }
    shell.showItemInFolder(path)
    return { status: 'created', path }
  })
}
