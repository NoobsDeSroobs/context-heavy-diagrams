import { ElectronAPI } from '@electron-toolkit/preload'
import type { DiagramFile } from '@shared/diagram'

export interface DiagramApi {
  openDiagram(): Promise<{ path: string; diagram: DiagramFile } | null>
  saveDiagram(path: string, diagram: DiagramFile): Promise<void>
  pickSavePath(): Promise<string | null>
  pickAndCopyCustomIcon(diagramPath: string): Promise<string | null>
  listCustomIcons(diagramPath: string): Promise<string[]>
  readIconAsDataUrl(diagramPath: string, relativePath: string): Promise<string>
  readDetails(diagramPath: string, relativePath: string): Promise<string>
  writeDetails(diagramPath: string, nodeId: string, content: string): Promise<string>
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: DiagramApi
  }
}
