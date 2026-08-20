import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type { DiagramFile, RequiredTagDefinition } from '@shared/diagram'

interface RequiredTagsWalkResult {
  reached: string[]
  external: string[]
  unreadable: string[]
}

// Custom APIs for renderer. See docs/decisions/0005-diagram-identity-and-linking.md
// for the single-file model. pickSavePath and saveDiagram are deliberately
// separate (not one combined "save as" call) — epic 0008 needs to pick the
// path, flush any pending detail-panel drafts using it, *then* write the
// final diagram content, all before the file actually lands on disk.
const api = {
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
  },

  // No dialog — used by a window's own initial-load mount effect, given
  // an absolute path via ?path= query string (ADR 0023).
  openDiagramAtPath(path: string): Promise<DiagramFile> {
    return ipcRenderer.invoke('diagram:openPath', path)
  },

  // Linked diagrams — see epic 0009 / docs/decisions/0005-diagram-identity-and-linking.md.
  // createLinkedDiagram/pickExistingLinkedDiagram both return a relative
  // path (relative to diagramPath's own directory) to store on the node,
  // same convention as custom icon/detail paths.
  createLinkedDiagram(diagramPath: string, label: string): Promise<string> {
    return ipcRenderer.invoke('links:createNew', diagramPath, label)
  },

  pickExistingLinkedDiagram(diagramPath: string): Promise<string | null> {
    return ipcRenderer.invoke('links:pickExisting', diagramPath)
  },

  // Multi-window model — see ADR 0023. All three open a new window (or
  // focus an existing one already showing that path) rather than ever
  // replacing the diagram in the window they were called from.
  newWindow(): Promise<void> {
    return ipcRenderer.invoke('windows:openNew')
  },

  // isCurrentWindowEmpty: pass true when the calling window's own diagram
  // has zero nodes/edges — reuses that window instead of leaving it
  // sitting there empty next to the newly-opened one (main only actually
  // reuses it if the picked path isn't already open elsewhere).
  openInNewWindow(isCurrentWindowEmpty: boolean): Promise<void> {
    return ipcRenderer.invoke('windows:pickAndOpen', isCurrentWindowEmpty)
  },

  openLinkedInNewWindow(
    diagramPath: string,
    relativePath: string
  ): Promise<{ found: true } | { found: false; resolvedPath: string }> {
    return ipcRenderer.invoke('windows:openLinked', diagramPath, relativePath)
  },

  // Propagating a required-tags template down the link tree — see epic
  // 0035 / ADR 0024. directChildRelativePaths comes from the caller's own
  // live node state (may include unsaved link edits); every deeper level
  // is discovered by reading each reached diagram's own file.
  previewRequiredTagsChildren(
    diagramPath: string,
    directChildRelativePaths: string[]
  ): Promise<RequiredTagsWalkResult> {
    return ipcRenderer.invoke('requiredTags:previewChildren', diagramPath, directChildRelativePaths)
  },

  copyRequiredTagsToChildren(
    diagramPath: string,
    requiredTags: RequiredTagDefinition[],
    directChildRelativePaths: string[]
  ): Promise<RequiredTagsWalkResult> {
    return ipcRenderer.invoke(
      'requiredTags:copyToChildren',
      diagramPath,
      requiredTags,
      directChildRelativePaths
    )
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
