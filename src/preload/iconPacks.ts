import { contextBridge, ipcRenderer } from 'electron'
import type {
  InstallProgress,
  InstallResult,
  PackList,
  RemoveResult
} from '@shared/icons/installedPacks'

// The bridge of the icon pack manager, and only of the icon pack manager (src/main/icons/
// packManager.ts). It installs and removes packs, so it is kept to exactly that: no diagram is read
// or written here, and the editor's bridge (index.ts) cannot install or remove a pack (ADR 0112).
//
// A method shared with index.ts has the name and the channel it has there; a test
// (iconPacks.test.mjs) keeps this list equal to what the manager's code can reach.
const api = {
  listIconPacks(): Promise<PackList> {
    return ipcRenderer.invoke('iconPacks:list')
  },

  onIconPacksChanged(callback: () => void): () => void {
    const listener = (): void => callback()
    ipcRenderer.on('iconPacks:changed', listener)
    return () => ipcRenderer.off('iconPacks:changed', listener)
  },

  // Asks for a folder, then installs it. One at a time; the answer says what happened.
  installIconPack(): Promise<InstallResult> {
    return ipcRenderer.invoke('iconPacks:install')
  },

  // Installs the Tabler pack that comes with the app.
  installTablerPack(): Promise<InstallResult> {
    return ipcRenderer.invoke('iconPacks:installTabler')
  },

  cancelIconPackInstall(): Promise<void> {
    return ipcRenderer.invoke('iconPacks:cancelInstall')
  },

  removeIconPack(folder: string): Promise<RemoveResult> {
    return ipcRenderer.invoke('iconPacks:remove', folder)
  },

  showIconPacksFolder(): Promise<void> {
    return ipcRenderer.invoke('iconPacks:showFolder')
  },

  // An install the app started itself (the first-start question) has ended.
  onIconPackInstallEnded(callback: (result: InstallResult) => void): () => void {
    const listener = (_event: unknown, result: InstallResult): void => callback(result)
    ipcRenderer.on('iconPacks:installEnded', listener)
    return () => ipcRenderer.off('iconPacks:installEnded', listener)
  },

  onIconPackProgress(callback: (progress: InstallProgress) => void): () => void {
    const listener = (_event: unknown, progress: InstallProgress): void => callback(progress)
    ipcRenderer.on('iconPacks:progress', listener)
    return () => ipcRenderer.off('iconPacks:progress', listener)
  }
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.api = api
}
