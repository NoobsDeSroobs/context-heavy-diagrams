import { ElectronAPI } from '@electron-toolkit/preload'
import type { DiagramFile } from '@shared/diagram'

export interface DiagramApi {
  openDiagram(): Promise<{ path: string; diagram: DiagramFile } | null>
  saveDiagram(path: string, diagram: DiagramFile): Promise<void>
  saveDiagramAs(diagram: DiagramFile): Promise<string | null>
  pickAndCopyCustomIcon(diagramPath: string): Promise<string | null>
  listCustomIcons(diagramPath: string): Promise<string[]>
  readIconAsDataUrl(diagramPath: string, relativePath: string): Promise<string>
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: DiagramApi
  }
}
