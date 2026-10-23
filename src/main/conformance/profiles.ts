import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron'
import { mkdir, readFile, writeFile } from 'fs/promises'
import { join } from 'path'
import { PROFILE_FILE_SUFFIX } from '@shared/conformance/profile'
import {
  newProfileText,
  profileNameFromPath,
  withProfileSuffix
} from '@shared/conformance/newProfile'
import type { NewProfileResult, ProfilesFolderInfo } from '@shared/conformance/profilesFolder'
import { readPreferences, updatePreferences } from '../preferences/appPreferences'

// The user's conformance profiles (ADR 0131): a folder (a Preferences setting, by default
// `profiles` in the user-data folder) and "New profile", which copies the shipped template there.
// The OS dialogs are the user's consent: nothing is written anywhere they did not just choose.

async function folderInfo(): Promise<ProfilesFolderInfo> {
  const chosen = (await readPreferences())?.profilesFolder
  return chosen
    ? { folder: chosen, isDefault: false }
    : { folder: join(app.getPath('userData'), 'profiles'), isDefault: true }
}

// resources/profiles/** ships in dev and packaged (asarUnpack: resources/**); the template is read
// with Electron's asar-aware fs either way.
function templatePath(): string {
  return join(app.getAppPath(), 'resources', 'profiles', `template${PROFILE_FILE_SUFFIX}`)
}

export function registerProfileHandlers(): void {
  ipcMain.handle('profiles:getFolder', () => folderInfo())

  ipcMain.handle('profiles:chooseFolder', async (event): Promise<string | null> => {
    const win = BrowserWindow.fromWebContents(event.sender)
    const options: Electron.OpenDialogOptions = {
      title: 'Choose the folder for your conformance profiles',
      defaultPath: (await folderInfo()).folder,
      properties: ['openDirectory', 'createDirectory']
    }
    const picked = win
      ? await dialog.showOpenDialog(win, options)
      : await dialog.showOpenDialog(options)
    if (picked.canceled || picked.filePaths.length === 0) return null
    await updatePreferences({ profilesFolder: picked.filePaths[0] })
    return picked.filePaths[0]
  })

  // The file name picked in the save dialog is the profile's name. Never overwrites: the file is
  // created or the call reports that it exists (the same rule as every other writer, ADR 0109).
  ipcMain.handle('profiles:create', async (event): Promise<NewProfileResult> => {
    const win = BrowserWindow.fromWebContents(event.sender)
    const { folder } = await folderInfo()
    await mkdir(folder, { recursive: true })
    const options: Electron.SaveDialogOptions = {
      title: 'New conformance profile',
      defaultPath: join(folder, `my-architecture-style${PROFILE_FILE_SUFFIX}`),
      buttonLabel: 'Create',
      filters: [{ name: 'Conformance profile', extensions: ['json'] }]
    }
    const picked = win
      ? await dialog.showSaveDialog(win, options)
      : await dialog.showSaveDialog(options)
    if (picked.canceled || !picked.filePath) return { status: 'cancelled' }

    const path = withProfileSuffix(picked.filePath)
    const text = newProfileText(await readFile(templatePath(), 'utf-8'), profileNameFromPath(path))
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
