import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type { DiagramFile } from '@shared/diagram'

// Custom APIs for renderer. See docs/decisions/0005-diagram-identity-and-linking.md
// for the single-file model — saveDiagramAs is just "pick a path, write to
// it," no folder/directory handling at all.
const api = {
  openDiagram(): Promise<{ path: string; diagram: DiagramFile } | null> {
    return ipcRenderer.invoke('diagram:open')
  },

  saveDiagram(path: string, diagram: DiagramFile): Promise<void> {
    return ipcRenderer.invoke('diagram:save', path, diagram)
  },

  async saveDiagramAs(diagram: DiagramFile): Promise<string | null> {
    const path: string | null = await ipcRenderer.invoke('diagram:pickSavePath')
    if (!path) return null
    await ipcRenderer.invoke('diagram:save', path, diagram)
    return path
  },

  // Custom icons — see docs/decisions/0006-icon-storage-model.md. All three
  // need the diagram's own path to resolve its sibling assets/ folder.
  pickAndCopyCustomIcon(diagramPath: string): Promise<string | null> {
    return ipcRenderer.invoke('icons:pickAndCopyCustom', diagramPath)
  },

  listCustomIcons(diagramPath: string): Promise<string[]> {
    return ipcRenderer.invoke('icons:listCustom', diagramPath)
  },

  readIconAsDataUrl(diagramPath: string, relativePath: string): Promise<string> {
    return ipcRenderer.invoke('icons:readAsDataUrl', diagramPath, relativePath)
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
