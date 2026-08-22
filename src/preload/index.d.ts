import { ElectronAPI } from '@electron-toolkit/preload'
import type { DiagramFile, RequiredTagDefinition } from '@shared/diagram'

export interface RequiredTagsWalkResult {
  reached: string[]
  external: string[]
  unreadable: string[]
}

export interface DiagramApi {
  openDiagramAtPath(path: string): Promise<DiagramFile>
  saveDiagram(path: string, diagram: DiagramFile, sessionId: string): Promise<void>
  pickSavePath(): Promise<string | null>
  pickAndCopyCustomIcon(diagramPath: string): Promise<string | null>
  listCustomIcons(diagramPath: string): Promise<string[]>
  readIconAsDataUrl(diagramPath: string, relativePath: string): Promise<string>
  readDetails(diagramPath: string, relativePath: string): Promise<string>
  writeDetails(diagramPath: string, nodeId: string, content: string): Promise<string>
  createLinkedDiagram(diagramPath: string, label: string): Promise<string>
  pickExistingLinkedDiagram(diagramPath: string): Promise<string | null>
  newWindow(): Promise<void>
  openInNewWindow(isCurrentWindowEmpty: boolean): Promise<void>
  openLinkedInNewWindow(
    diagramPath: string,
    relativePath: string
  ): Promise<{ found: true } | { found: false; resolvedPath: string }>
  clearWindowPath(): Promise<void>
  getPathForFile(file: File): string
  handleDroppedFiles(
    paths: string[],
    callingWindowEmpty: boolean,
    callingWindowDirty: boolean,
    callingWindowPath: string | null,
    callingWindowSessionId: string
  ): Promise<void>
  onPerformSaveThenOpenDropped(callback: (path: string) => void): () => void
  confirmSavedThenOpen(path: string): Promise<void>
  previewRequiredTagsChildren(
    diagramPath: string,
    directChildRelativePaths: string[]
  ): Promise<RequiredTagsWalkResult>
  copyRequiredTagsToChildren(
    diagramPath: string,
    requiredTags: RequiredTagDefinition[],
    directChildRelativePaths: string[]
  ): Promise<RequiredTagsWalkResult>
  writeRecoverySnapshot(
    path: string | null,
    sessionId: string,
    diagram: DiagramFile,
    detailsDrafts: Record<string, string>
  ): Promise<void>
  deleteRecoverySnapshot(path: string | null, sessionId: string): Promise<void>
  checkRecoveryForPath(
    path: string
  ): Promise<{ diagram: DiagramFile; detailsDrafts: Record<string, string> } | null>
  onRecoveredOrphan(
    callback: (snapshot: { diagram: DiagramFile; detailsDrafts: Record<string, string> }) => void
  ): () => void
  onCloseRequested(callback: () => void): () => void
  requestCloseDecision(): Promise<'save' | 'discard' | 'cancel'>
  closeApproved(path: string | null, sessionId: string): Promise<void>
  mirrorScanOnStartupSetting(value: boolean): Promise<void>
  getAppVersion(): Promise<string>
  exportStylePalette(json: string): Promise<boolean>
  importStylePalette(): Promise<string | null>
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: DiagramApi
  }
}
