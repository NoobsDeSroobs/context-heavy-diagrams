import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type { DiagramFile } from '@shared/diagram'

// Custom APIs for renderer. See docs/decisions/0005-diagram-identity-and-linking.md
// for the single-file model. pickSavePath and saveDiagram are deliberately
// separate (not one combined "save as" call) — epic 0008 needs to pick the
// path, flush any pending detail-panel drafts using it, *then* write the
// final diagram content, all before the file actually lands on disk.
const api = {
  openDiagram(): Promise<{ path: string; diagram: DiagramFile } | null> {
    return ipcRenderer.invoke('diagram:open')
  },

  saveDiagram(path: string, diagram: DiagramFile): Promise<void> {
    return ipcRenderer.invoke('diagram:save', path, diagram)
  },

  pickSavePath(): Promise<string | null> {
    return ipcRenderer.invoke('diagram:pickSavePath')
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
  },

  // Detail files — see epic 0008. readDetails takes an already-known
  // relative path; writeDetails takes a node id and computes the
  // conventional path itself, returning it so the caller can store it on
  // data.details the first time.
  readDetails(diagramPath: string, relativePath: string): Promise<string> {
    return ipcRenderer.invoke('details:read', diagramPath, relativePath)
  },

  writeDetails(diagramPath: string, nodeId: string, content: string): Promise<string> {
    return ipcRenderer.invoke('details:write', diagramPath, nodeId, content)
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
