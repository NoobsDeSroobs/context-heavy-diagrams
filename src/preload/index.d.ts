import { ElectronAPI } from '@electron-toolkit/preload'
import type { DiagramFile, RequiredTagDefinition } from '@shared/diagram'

export interface RequiredTagsWalkResult {
  reached: string[]
  external: string[]
  unreadable: string[]
}

export interface DiagramApi {
  openDiagramAtPath(path: string): Promise<DiagramFile>
  saveDiagram(path: string, diagram: DiagramFile): Promise<void>
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
  previewRequiredTagsChildren(
    diagramPath: string,
    directChildRelativePaths: string[]
  ): Promise<RequiredTagsWalkResult>
  copyRequiredTagsToChildren(
    diagramPath: string,
    requiredTags: RequiredTagDefinition[],
    directChildRelativePaths: string[]
  ): Promise<RequiredTagsWalkResult>
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: DiagramApi
  }
}
