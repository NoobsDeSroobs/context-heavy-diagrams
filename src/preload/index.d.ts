import { ElectronAPI } from '@electron-toolkit/preload'
import type { DiagramFile } from '@shared/diagram'

export type ResolveLinkResult =
  | { found: true; path: string; diagram: DiagramFile }
  | { found: false; resolvedPath: string }

export interface DiagramApi {
  openDiagram(): Promise<{ path: string; diagram: DiagramFile } | null>
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
  resolveLinkedDiagram(diagramPath: string, relativePath: string): Promise<ResolveLinkResult>
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: DiagramApi
  }
}
