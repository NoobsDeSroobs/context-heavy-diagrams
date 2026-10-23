import type { DiagramFile, RequiredTagDefinition } from '@shared/diagram'
import type {
  NoteBaseline,
  RecoverySnapshot,
  SaveDocumentRequest,
  SaveOutcome,
  Stamp
} from '@shared/document/documentSave'
import type { AiFolderResult, ClaudeExtensionOutcome } from '@shared/ai/aiFolderResult'
import type {
  NewProfileResult,
  ProfileListing,
  ProfilesFolderInfo
} from '@shared/conformance/profilesFolder'
import type { AppPreferences } from '@shared/preferences/preferences'
import type { SecurityCrawlResult } from '@shared/threat-matrix/threatMatrixMath'
import type { LinkedSearchLink, LinkedSearchResult } from '@shared/search/linkedSearch'
import type { SearchCriteria } from '@shared/search/search'

export interface RequiredTagsWalkResult {
  reached: string[]
  external: string[]
  unreadable: string[]
}

export interface DiagramApi {
  openDiagramAtPath(path: string): Promise<{ diagram: DiagramFile; stamp: Stamp }>
  rereadDiagramForDiff(path: string): Promise<DiagramFile | null>
  saveDocument(request: SaveDocumentRequest): Promise<SaveOutcome>
  pickSavePath(): Promise<string | null>
  pickAndCopyCustomIcon(diagramPath: string): Promise<string | null>
  listCustomIcons(diagramPath: string): Promise<string[]>
  readIconAsDataUrl(diagramPath: string, relativePath: string): Promise<string>
  pickAndCopyReferences(diagramPath: string): Promise<string[] | null>
  readReferenceAsDataUrl(diagramPath: string, relativePath: string): Promise<string>
  readDetails(diagramPath: string, relativePath: string): Promise<string>
  readDetailsWithStamp(
    diagramPath: string,
    relativePath: string
  ): Promise<{ content: string; stamp: Stamp }>
  checkFiles(
    diagramPath: string,
    entries: { relPath: string | null; stamp: Stamp }[]
  ): Promise<{ changed: boolean; stamp: Stamp }[]>
  createLinkedDiagram(diagramPath: string, label: string): Promise<string>
  pickExistingLinkedDiagram(diagramPath: string): Promise<string | null>
  checkResourceFiles(
    diagramPath: string,
    relativePaths: string[]
  ): Promise<{ relativePath: string; resolvedPath: string; found: boolean }[]>
  crawlLinkedSecurity(
    diagramPath: string,
    links: { entityId: string; relativePath: string }[]
  ): Promise<SecurityCrawlResult>

  searchLinkedDiagrams(
    diagramPath: string,
    links: LinkedSearchLink[],
    criteria: SearchCriteria
  ): Promise<LinkedSearchResult>

  newWindow(): Promise<void>
  openInNewWindow(isCurrentWindowEmpty: boolean): Promise<void>
  openLinkedInNewWindow(
    diagramPath: string,
    relativePath: string
  ): Promise<{ found: true } | { found: false; resolvedPath: string }>
  openRecentDiagram(path: string, isCurrentWindowEmpty: boolean): Promise<{ found: boolean }>
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
    detailsDrafts: Record<string, string>,
    noteBaselines?: Record<string, NoteBaseline>
  ): Promise<void>
  deleteRecoverySnapshot(path: string | null, sessionId: string): Promise<void>
  checkRecoveryForPath(path: string): Promise<RecoverySnapshot | null>
  onRecoveredOrphan(callback: (snapshot: RecoverySnapshot) => void): () => void
  onCloseRequested(callback: () => void): () => void
  requestCloseDecision(detail?: string): Promise<'save' | 'discard' | 'cancel'>
  closeApproved(path: string | null, sessionId: string): Promise<void>
  readPreferences(): Promise<AppPreferences | null>
  writePreferences(preferences: AppPreferences): Promise<void>
  onPreferencesChanged(callback: (preferences: AppPreferences) => void): () => void
  getAppVersion(): Promise<string>
  enableAiInFolder(): Promise<AiFolderResult | null>
  installClaudeExtension(): Promise<ClaudeExtensionOutcome>
  getProfilesFolder(): Promise<ProfilesFolderInfo>
  listProfiles(): Promise<ProfileListing[]>
  loadProfile(id: string): Promise<string | null>
  chooseProfilesFolder(): Promise<string | null>
  createProfile(): Promise<NewProfileResult>
  exportStylePalette(json: string): Promise<boolean>
  importStylePalette(): Promise<{ name: string; content: string } | null>
  exportPngToFile(dataUrl: string, suggestedFilename: string): Promise<boolean>
  exportSvgToFile(svg: string, suggestedFilename: string): Promise<boolean>
  copyToClipboard(text: string): void
  readClipboardText(): string
  platform: NodeJS.Platform
}

declare global {
  interface Window {
    api: DiagramApi
  }
}
