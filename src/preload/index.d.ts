import { ElectronAPI } from '@electron-toolkit/preload'
import type { DiagramFile } from '@shared/diagram'

export interface DiagramApi {
  openDiagram(): Promise<{ path: string; diagram: DiagramFile } | null>
  saveDiagram(path: string, diagram: DiagramFile): Promise<void>
  saveDiagramAs(diagram: DiagramFile): Promise<string | null>
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: DiagramApi
  }
}
