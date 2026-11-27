import type { DiagramFile } from '@shared/diagram'
import type { Theme } from '@shared/styling/theme'
import { renderDiagramDrawio, type DrawioExport } from '@shared/export/drawio'
import { collectIconRefs, iconKey, type IconAsset } from '@shared/export/renderDiagram'
import { loadIconAsset } from './iconAssets'

export interface DrawioExportParams {
  theme: Theme
  enabledHighlightIds: string[]
  diagramPath: string | null
  // The font the app draws this diagram in, when the diagram has none of its own.
  fontFamily?: string
  title?: string
}

// Resolves every icon the diagram draws, then renders. An icon that cannot be read is
// left out, not fatal, as in the SVG export.
export async function buildDiagramDrawio(
  diagram: DiagramFile,
  params: DrawioExportParams
): Promise<DrawioExport> {
  const icons = new Map<string, IconAsset>()
  await Promise.all(
    collectIconRefs(diagram, []).map(async (icon) => {
      const asset = await loadIconAsset(icon, params.diagramPath)
      if (asset) icons.set(iconKey(icon), asset)
    })
  )
  return renderDiagramDrawio(diagram, {
    theme: params.theme,
    enabledHighlightIds: params.enabledHighlightIds,
    icons,
    fontFamily: params.fontFamily,
    title: params.title
  })
}
