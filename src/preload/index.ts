import { contextBridge, ipcRenderer, webUtils } from 'electron'
import type { DiagramFile, RequiredTagDefinition } from '@shared/diagram'
import type { CompareSession } from '@shared/compare/session'
import type {
  RevertChange,
  RevertIdMatches,
  RevertKind,
  RevertRequest,
  RevertResult
} from '@shared/compare/revert'
import type {
  NoteBaseline,
  RecoverySnapshot,
  SaveDocumentRequest,
  SaveOutcome,
  Stamp
} from '@shared/document/documentSave'
import type { PlanSaveAsRequest, SaveAsPlan } from '@shared/document/saveAsCopy'
import type {
  AiFolderResult,
  ClaudeExtensionOutcome,
  McpSettingsResult
} from '@shared/ai/aiFolderResult'
import type {
  NewMetamodelResult,
  MetamodelListing,
  MetamodelsFolderInfo
} from '@shared/conformance/metamodelsFolder'
import type { AppPreferences } from '@shared/preferences/preferences'
import type { SecurityCrawlResult } from '@shared/threat-matrix/threatMatrixMath'
import type { LinkedSearchLink, LinkedSearchResult } from '@shared/search/linkedSearch'
import type { SearchCriteria } from '@shared/search/search'

interface RequiredTagsWalkResult {
  reached: string[]
  external: string[]
  unreadable: string[]
}

// Custom APIs for renderer. See docs/decisions/0005-diagram-identity-and-linking.md
// for the single-file model. pickSavePath and saveDocument are deliberately
// separate (not one combined "save as" call) — the save flow needs to pick
// the path first, then plan the whole save (diagram + its notes, ADR 0092)
// against it.
const api = {
  // Saves the diagram and its notes as one plan (ADR 0092). Everything that
  // doesn't conflict is saved; `conflicts` in the outcome lists what was held back
  // — resolve per file, then call again with overwrite: true for just those.
  saveDocument(request: SaveDocumentRequest): Promise<SaveOutcome> {
    return ipcRenderer.invoke('document:save', request)
  },

  pickSavePath(suggested?: string): Promise<string | null> {
    return ipcRenderer.invoke('diagram:pickSavePath', suggested)
  },

  // What a Save As would copy, and whether it can be made (ADR 0160).
  planSaveAs(request: PlanSaveAsRequest): Promise<SaveAsPlan> {
    return ipcRenderer.invoke('document:planSaveAs', request)
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

  // Reference images (see ADR 0069) — same sibling-folder model as
  // custom icons, into assets/references/. pickAndCopy allows multi-select
  // and returns every copied file's relative path (null on cancel).
  pickAndCopyReferences(diagramPath: string): Promise<string[] | null> {
    return ipcRenderer.invoke('references:pickAndCopy', diagramPath)
  },

  readReferenceAsDataUrl(diagramPath: string, relativePath: string): Promise<string> {
    return ipcRenderer.invoke('references:readAsDataUrl', diagramPath, relativePath)
  },

  // Note files — see ADR 0060 for the label+uuid naming convention.
  // Reading only: notes are *written* (and renamed to follow a label) as part
  // of saveDocument (ADR 0092).
  readNotes(diagramPath: string, relativePath: string): Promise<string> {
    return ipcRenderer.invoke('notes:read', diagramPath, relativePath)
  },

  // Content plus the file's change fingerprint — the note's baseline (ADR 0092).
  readNotesWithStamp(
    diagramPath: string,
    relativePath: string
  ): Promise<{ content: string; stamp: Stamp }> {
    return ipcRenderer.invoke('notes:readWithStamp', diagramPath, relativePath)
  },

  // No dialog — used by a window's own initial-load mount effect, given
  // an absolute path via ?path= query string (ADR 0023).
  // Returns the diagram and its file's change fingerprint (the hub's baseline).
  openDiagramAtPath(path: string): Promise<{ diagram: DiagramFile; stamp: Stamp }> {
    return ipcRenderer.invoke('diagram:openPath', path)
  },

  // Side-effect-free reread for "changes since last save" (ADR 0102) —
  // unlike openDiagramAtPath, never records the file as
  // opened/recent. Resolves null if the path no longer resolves.
  rereadDiagramForDiff(path: string): Promise<DiagramFile | null> {
    return ipcRenderer.invoke('diagram:rereadForDiff', path)
  },

  // The one "did a file change on disk since I last looked" check (ADR 0092),
  // for the diagram (relPath null) and/or notes (folder-relative paths).
  checkFiles(
    diagramPath: string,
    entries: { relPath: string | null; stamp: Stamp }[]
  ): Promise<{ changed: boolean; stamp: Stamp }[]> {
    return ipcRenderer.invoke('files:check', diagramPath, entries)
  },

  // Linked diagrams — see docs/decisions/0005-diagram-identity-and-linking.md.
  // createLinkedDiagram/pickExistingLinkedDiagram both return a relative
  // path (relative to diagramPath's own directory) to store on the node,
  // same convention as custom icon/note paths.
  createLinkedDiagram(diagramPath: string, label: string): Promise<string> {
    return ipcRenderer.invoke('links:createNew', diagramPath, label)
  },

  pickExistingLinkedDiagram(diagramPath: string): Promise<string | null> {
    return ipcRenderer.invoke('links:pickExisting', diagramPath)
  },

  // Bulk existence check for the Diagnostics "missing files" section
  // (ADR 0084) — linked diagrams, custom icons, reference images, notes
  // files. One result per input relative path, in input order.
  checkResourceFiles(
    diagramPath: string,
    relativePaths: string[]
  ): Promise<{ relativePath: string; resolvedPath: string; found: boolean }[]> {
    return ipcRenderer.invoke('resources:checkExist', diagramPath, relativePaths)
  },

  // Recursive security-matrix rollup (ADR 0088) — walk each linked matrix
  // entity's subtree and return a CrawledMatrix per root column. Read-only;
  // never records the visited files as "opened". `links` is the subset of
  // the diagram's matrix entities that carry a `data.linkedDiagram`.
  crawlLinkedSecurity(
    diagramPath: string,
    links: { entityId: string; relativePath: string }[]
  ): Promise<SecurityCrawlResult> {
    return ipcRenderer.invoke('security:crawlLinked', diagramPath, links)
  },

  // Deep search (ADR 0097) — the criteria the open diagram was just searched
  // with, run over the subtree behind each of the open diagram's links; returns
  // which links have a match somewhere below. Read-only.
  searchLinkedDiagrams(
    diagramPath: string,
    links: LinkedSearchLink[],
    criteria: SearchCriteria
  ): Promise<LinkedSearchResult> {
    return ipcRenderer.invoke('search:linkedDiagrams', diagramPath, links, criteria)
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

  // The compare window (ADR 0132): the editor hands over two whole versions, and the window asks
  // for them by the id in its URL.
  openCompareWindow(session: CompareSession): Promise<void> {
    return ipcRenderer.invoke('compare:open', session)
  },
  compareWithGit(
    diagramPath: string,
    revision: string
  ): Promise<{ ok: boolean; message?: string }> {
    return ipcRenderer.invoke('compare:openGit', diagramPath, revision)
  },
  // Put one element back as the earlier version has it: asked for here, done in the editor window
  // of the same diagram (compare:revert), which answers with answerCompareRevert.
  revertFromCompare(
    sessionId: string,
    kind: RevertKind,
    id: string,
    change: RevertChange,
    matches?: RevertIdMatches
  ): Promise<RevertResult> {
    return ipcRenderer.invoke('compare:revert', sessionId, kind, id, change, matches)
  },
  onCompareRevertRequest(callback: (request: RevertRequest) => void): () => void {
    const listener = (_event: unknown, request: RevertRequest): void => callback(request)
    ipcRenderer.on('compare:revertRequest', listener)
    return () => ipcRenderer.off('compare:revertRequest', listener)
  },
  answerCompareRevert(requestId: string, result: RevertResult): Promise<void> {
    return ipcRenderer.invoke('compare:revertResult', requestId, result)
  },
  getCompareSession(id: string): Promise<CompareSession | null> {
    return ipcRenderer.invoke('compare:getSession', id)
  },

  openLinkedInNewWindow(
    diagramPath: string,
    relativePath: string
  ): Promise<{ found: true } | { found: false; resolvedPath: string }> {
    return ipcRenderer.invoke('windows:openLinked', diagramPath, relativePath)
  },

  // File -> Recent Diagrams — absolute path, no dialog. found:false means
  // the file is gone and main has already pruned it from the list.
  // isCurrentWindowEmpty: same reuse-if-nothing-to-lose rule as
  // openInNewWindow above.
  openRecentDiagram(path: string, isCurrentWindowEmpty: boolean): Promise<{ found: boolean }> {
    return ipcRenderer.invoke('windows:openRecent', path, isCurrentWindowEmpty)
  },

  // File -> Close resets this window's content in-place, not via a page
  // navigation — clears main's stale "this window shows path X"
  // registration so reopening that same file afterward actually reloads
  // it instead of just focusing the (now blank) window.
  clearWindowPath(): Promise<void> {
    return ipcRenderer.invoke('windows:clearPath')
  },

  // Shows this window's diagram file in the OS file manager.
  showDiagramInFolder(path: string): Promise<boolean> {
    return ipcRenderer.invoke('windows:showInFolder', path)
  },

  // Drag-and-drop — recent Electron versions removed the
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

  // Propagating a required-tags template down the link tree — see
  // ADR 0024. directChildRelativePaths comes from the caller's own
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

  // Crash recovery — see ADR 0040. path is null for a diagram
  // that hasn't been saved yet, in which case sessionId is what actually
  // keys the recovery snapshot (see recovery.ts's keyFor). noteDrafts
  // rides alongside diagram, not inside it — see recovery.ts's own comment
  // on RecoveryEnvelope for why.
  writeRecoverySnapshot(
    path: string | null,
    sessionId: string,
    diagram: DiagramFile,
    noteDrafts: Record<string, string>,
    noteBaselines?: Record<string, NoteBaseline>
  ): Promise<void> {
    return ipcRenderer.invoke('recovery:write', path, sessionId, diagram, noteDrafts, noteBaselines)
  },

  deleteRecoverySnapshot(path: string | null, sessionId: string): Promise<void> {
    return ipcRenderer.invoke('recovery:delete', path, sessionId)
  },

  checkRecoveryForPath(path: string): Promise<RecoverySnapshot | null> {
    return ipcRenderer.invoke('recovery:checkForPath', path)
  },

  // Startup orphan scan (main-driven) tells a freshly created window to
  // load a recovered diagram instead of starting blank — subscribed once
  // per window, unsubscribed on unmount.
  onRecoveredOrphan(callback: (snapshot: RecoverySnapshot) => void): () => void {
    const listener = (_event: unknown, snapshot: RecoverySnapshot): void => callback(snapshot)
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

  // `detail` (ADR 0102): an optional one-line change-count
  // ("3 modified, 1 added") shown in the native dialog's detail text.
  requestCloseDecision(detail?: string): Promise<'save' | 'discard' | 'cancel'> {
    return ipcRenderer.invoke('windows:requestCloseDecision', detail)
  },

  closeApproved(path: string | null, sessionId: string): Promise<void> {
    return ipcRenderer.invoke('windows:closeApproved', path, sessionId)
  },

  // Real per-OS preferences file (see ADR 0053), replacing localStorage
  // — see appPreferences.ts. readPreferences returns null when the file
  // doesn't exist yet (fresh install, or upgrading from a build predating it);
  // the renderer's usePreferences falls back to its own already-present
  // localStorage in that case, one-time migration, before defaults.
  readPreferences(): Promise<AppPreferences | null> {
    return ipcRenderer.invoke('preferences:read')
  },

  writePreferences(preferences: AppPreferences): Promise<void> {
    return ipcRenderer.invoke('preferences:write', preferences)
  },

  // Cross-window live sync — the replacement for the `storage` event a
  // shared localStorage key gave for free.
  onPreferencesChanged(callback: (preferences: AppPreferences) => void): () => void {
    const listener = (_event: unknown, preferences: AppPreferences): void => callback(preferences)
    ipcRenderer.on('preferences:changed', listener)
    return () => ipcRenderer.off('preferences:changed', listener)
  },

  // About screen — package.json's version via Electron's own
  // app.getVersion(), see ADR 0044. Not cached here; called once per About
  // open, cheap enough not to bother.
  getAppVersion(): Promise<string> {
    return ipcRenderer.invoke('app:getVersion')
  },

  // AI -> Set up a folder for AI agents (ADR 0105): folder picker + file
  // writes happen in main; null means the user cancelled the picker.
  enableAiInFolder(): Promise<AiFolderResult | null> {
    return ipcRenderer.invoke('ai:enableInFolder')
  },

  // AI -> Install Claude Desktop extension (ADR 0110): main shows the dialogs
  // and asks the OS to open the bundled .mcpb.
  installClaudeExtension(): Promise<ClaudeExtensionOutcome> {
    return ipcRenderer.invoke('ai:installExtension')
  },

  // AI -> Install the MCP server for -> Other apps (ADR 0110): main asks for the folder and the
  // update choice and returns the settings to paste into the app.
  mcpServerSettings(): Promise<McpSettingsResult> {
    return ipcRenderer.invoke('ai:mcpServerSettings')
  },

  // Diagram metamodels (ADR 0131): where they live, choosing that folder, and making a new one
  // from the template (a save dialog; the file is never overwritten).
  getMetamodelsFolder(): Promise<MetamodelsFolderInfo> {
    return ipcRenderer.invoke('metamodels:getFolder')
  },

  listMetamodels(): Promise<MetamodelListing[]> {
    return ipcRenderer.invoke('metamodels:list')
  },

  loadMetamodel(id: string): Promise<string | null> {
    return ipcRenderer.invoke('metamodels:load', id)
  },

  chooseMetamodelsFolder(): Promise<string | null> {
    return ipcRenderer.invoke('metamodels:chooseFolder')
  },

  createMetamodel(): Promise<NewMetamodelResult> {
    return ipcRenderer.invoke('metamodels:create')
  },

  // Style palette export/import (see ADR 0048) — returns false/null
  // on cancel, same "no error, just nothing happened" convention as
  // diagram:pickSavePath.
  exportStylePalette(json: string): Promise<boolean> {
    return ipcRenderer.invoke('stylePalette:exportToFile', json)
  },

  importStylePalette(): Promise<{ name: string; content: string } | null> {
    return ipcRenderer.invoke('stylePalette:importFromFile')
  },

  // PNG export (see ADR 0051) — dataUrl is a data:image/png;base64,...
  // string from html-to-image's toPng(), same false-on-cancel convention
  // as exportStylePalette.
  exportPngToFile(dataUrl: string, suggestedFilename: string): Promise<boolean> {
    return ipcRenderer.invoke('export:pngToFile', dataUrl, suggestedFilename)
  },

  // SVG export (ADR 0124) — the finished document text; same false-on-cancel convention.
  exportSvgToFile(svg: string, suggestedFilename: string): Promise<boolean> {
    return ipcRenderer.invoke('export:svgToFile', svg, suggestedFilename)
  },
  exportDrawioToFile(xml: string, suggestedFilename: string): Promise<boolean> {
    return ipcRenderer.invoke('export:drawioToFile', xml, suggestedFilename)
  },

  // Copy/paste (see ADR 0049) — the real OS clipboard. The preload is
  // sandboxed (ADR 0112), which has no `clipboard` module, so main does it
  // (main/canvas/clipboard.ts); the read is synchronous because paste is.
  copyToClipboard(text: string): void {
    ipcRenderer.send('clipboard:writeText', text)
  },

  readClipboardText(): string {
    return ipcRenderer.sendSync('clipboard:readText')
  },

  // The only thing the renderer needs to know about the host OS (to hide menu
  // items that exist for Windows/macOS only). Replaces the broad
  // @electron-toolkit/preload bridge, which exposed arbitrary IPC and a copy of
  // process.env to the page (ADR 0112).
  platform: process.platform
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
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
