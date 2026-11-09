import type { DiagramFile } from '@shared/diagram'
import type { Theme } from '@shared/styling/theme'
import { renderDiagramDrawio, type DrawioExport } from '@shared/export/drawio'
import { collectIconRefs, iconKey, type IconAsset } from '@shared/export/renderDiagram'
import { loadBuiltinIconSvg } from '../icons/builtinIcons'

export interface DrawioExportParams {
  theme: Theme
  enabledHighlightIds: string[]
  diagramPath: string | null
  // The font the app draws this diagram in, when the diagram has none of its own (ADR 0130).
  fontFamily?: string
  title?: string
}

// Resolves every icon the diagram draws, then renders (ADR 0167). An icon that cannot be read is
// left out, not fatal, as in the SVG export.
export async function buildDiagramDrawio(
  diagram: DiagramFile,
  params: DrawioExportParams
): Promise<DrawioExport> {
  const icons = new Map<string, IconAsset>()
  await Promise.all(
    collectIconRefs(diagram, []).map(async (icon) => {
      try {
        if (icon.source === 'builtin') {
          const markup = await loadBuiltinIconSvg(icon.id)
          if (markup) icons.set(iconKey(icon), { kind: 'svg', markup })
        } else if (params.diagramPath) {
          const dataUrl = await window.api.readIconAsDataUrl(params.diagramPath, icon.path)
          icons.set(iconKey(icon), { kind: 'image', dataUrl })
        }
      } catch {
        // Missing or unreadable: the icon is simply not drawn.
      }
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
