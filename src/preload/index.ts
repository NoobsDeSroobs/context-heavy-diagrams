import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type { DiagramFile } from '@shared/diagram'

// Custom APIs for renderer. See docs/decisions/0003-diagram-persistence-v1.md
// for why saveDiagramAs orchestrates two IPC round trips here rather than
// exposing the lower-level main-process handlers directly — window.prompt()
// doesn't exist in Electron, so naming happens via the OS folder picker's
// own "New folder" control instead of an in-app text prompt.
const api = {
  openDiagram(): Promise<{ path: string; diagram: DiagramFile } | null> {
    return ipcRenderer.invoke('diagram:open')
  },

  saveDiagram(path: string, diagram: DiagramFile): Promise<void> {
    return ipcRenderer.invoke('diagram:save', path, diagram)
  },

  async saveDiagramAs(diagram: DiagramFile): Promise<string | null> {
    const dir: string | null = await ipcRenderer.invoke('diagram:pickDirectory')
    if (!dir) return null
    return ipcRenderer.invoke('diagram:saveNew', dir, diagram)
  }
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
