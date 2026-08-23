import { clipboard, contextBridge, ipcRenderer, webUtils } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type { DiagramFile, RequiredTagDefinition } from '@shared/diagram'
import type { AppSettings } from '@shared/settings'

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
  saveDiagram(path: string, diagram: DiagramFile, sessionId: string): Promise<void> {
    return ipcRenderer.invoke('diagram:save', path, diagram, sessionId)
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

  // File -> Close resets this window's content in-place, not via a page
  // navigation — clears main's stale "this window shows path X"
  // registration so reopening that same file afterward actually reloads
  // it instead of just focusing the (now blank) window.
  clearWindowPath(): Promise<void> {
    return ipcRenderer.invoke('windows:clearPath')
  },

  // Drag-and-drop (epic 0038) — recent Electron versions removed the
  // renderer's direct File.path access for security; webUtils is the
  // preload-context-only replacement. Synchronous, not IPC — no main
  // round-trip needed just to resolve a path.
  getPathForFile(file: File): string {
    return webUtils.getPathForFile(file)
  },

  handleDroppedFiles(
    paths: string[],
    callingWindowEmpty: boolean,
    callingWindowDirty: boolean,
    callingWindowPath: string | null,
    callingWindowSessionId: string
  ): Promise<void> {
    return ipcRenderer.invoke(
      'windows:handleDroppedFiles',
      paths,
      callingWindowEmpty,
      callingWindowDirty,
      callingWindowPath,
      callingWindowSessionId
    )
  },

  // "Save changes, Open Here" (drop onto a dirty window) — main shows the dialog
  // but can't perform the save itself, so it asks back via this event;
  // once the renderer's own save flow finishes, confirmSavedThenOpen
  // tells main it's now safe to navigate this window to the dropped path.
  onPerformSaveThenOpenDropped(callback: (path: string) => void): () => void {
    const listener = (_event: unknown, path: string): void => callback(path)
    ipcRenderer.on('window:performSaveThenOpenDropped', listener)
    return () => ipcRenderer.off('window:performSaveThenOpenDropped', listener)
  },

  confirmSavedThenOpen(path: string): Promise<void> {
    return ipcRenderer.invoke('windows:confirmSavedThenOpen', path)
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
  },

  // Crash recovery — see epic 0020 / ADR 0040. path is null for a diagram
  // that hasn't been saved yet, in which case sessionId is what actually
  // keys the recovery snapshot (see recovery.ts's keyFor). detailsDrafts
  // rides alongside diagram, not inside it — see recovery.ts's own comment
  // on RecoveryEnvelope for why.
  writeRecoverySnapshot(
    path: string | null,
    sessionId: string,
    diagram: DiagramFile,
    detailsDrafts: Record<string, string>
  ): Promise<void> {
    return ipcRenderer.invoke('recovery:write', path, sessionId, diagram, detailsDrafts)
  },

  deleteRecoverySnapshot(path: string | null, sessionId: string): Promise<void> {
    return ipcRenderer.invoke('recovery:delete', path, sessionId)
  },

  checkRecoveryForPath(
    path: string
  ): Promise<{ diagram: DiagramFile; detailsDrafts: Record<string, string> } | null> {
    return ipcRenderer.invoke('recovery:checkForPath', path)
  },

  // Startup orphan scan (main-driven) tells a freshly created window to
  // load a recovered diagram instead of starting blank — subscribed once
  // per window, unsubscribed on unmount.
  onRecoveredOrphan(
    callback: (snapshot: { diagram: DiagramFile; detailsDrafts: Record<string, string> }) => void
  ): () => void {
    const listener = (
      _event: unknown,
      snapshot: { diagram: DiagramFile; detailsDrafts: Record<string, string> }
    ): void => callback(snapshot)
    ipcRenderer.on('recovery:loadOrphan', listener)
    return () => ipcRenderer.off('recovery:loadOrphan', listener)
  },

  // Real OS close (close button, Alt+F4) — main asks the renderer whether
  // it's safe to close; this event fires that request. requestCloseDecision
  // shows the native Save/Discard/Cancel dialog and returns the choice;
  // closeApproved tells main it's now safe to actually close the window.
  onCloseRequested(callback: () => void): () => void {
    const listener = (): void => callback()
    ipcRenderer.on('window:closeRequested', listener)
    return () => ipcRenderer.off('window:closeRequested', listener)
  },

  requestCloseDecision(): Promise<'save' | 'discard' | 'cancel'> {
    return ipcRenderer.invoke('windows:requestCloseDecision')
  },

  closeApproved(path: string | null, sessionId: string): Promise<void> {
    return ipcRenderer.invoke('windows:closeApproved', path, sessionId)
  },

  // Real per-OS settings file (epic 0054/ADR 0053), replacing localStorage
  // — see appSettings.ts. readAppSettings returns null when the file
  // doesn't exist yet (fresh install, or upgrading from a pre-0054 build);
  // the renderer's useSettings falls back to its own already-present
  // localStorage in that case, one-time migration, before defaults.
  readAppSettings(): Promise<AppSettings | null> {
    return ipcRenderer.invoke('settings:read')
  },

  writeAppSettings(settings: AppSettings): Promise<void> {
    return ipcRenderer.invoke('settings:write', settings)
  },

  // Cross-window live sync — the replacement for the `storage` event a
  // shared localStorage key gave for free.
  onAppSettingsChanged(callback: (settings: AppSettings) => void): () => void {
    const listener = (_event: unknown, settings: AppSettings): void => callback(settings)
    ipcRenderer.on('settings:changed', listener)
    return () => ipcRenderer.off('settings:changed', listener)
  },

  // About screen (epic 0057) — package.json's version via Electron's own
  // app.getVersion(), see ADR 0044. Not cached here; called once per About
  // open, cheap enough not to bother.
  getAppVersion(): Promise<string> {
    return ipcRenderer.invoke('app:getVersion')
  },

  // Style palette export/import (epic 0030/ADR 0048) — returns false/null
  // on cancel, same "no error, just nothing happened" convention as
  // diagram:pickSavePath.
  exportStylePalette(json: string): Promise<boolean> {
    return ipcRenderer.invoke('stylePalette:exportToFile', json)
  },

  importStylePalette(): Promise<string | null> {
    return ipcRenderer.invoke('stylePalette:importFromFile')
  },

  // PNG export (epic 0010/ADR 0051) — dataUrl is a data:image/png;base64,...
  // string from html-to-image's toPng(), same false-on-cancel convention
  // as exportStylePalette.
  exportPngToFile(dataUrl: string, suggestedFilename: string): Promise<boolean> {
    return ipcRenderer.invoke('export:pngToFile', dataUrl, suggestedFilename)
  },

  // Copy/paste (epic 0025/ADR 0049) — the real OS clipboard, not IPC to
  // main: `clipboard` is available directly here since this window's
  // preload runs unsandboxed (`sandbox: false`, main/windows.ts), so
  // there's no round-trip needed for a synchronous, already-local API.
  copyToClipboard(text: string): void {
    clipboard.writeText(text)
  },

  readClipboardText(): string {
    return clipboard.readText()
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
