import type { DiagramFile } from '@shared/diagram'
import type { Theme } from '@shared/theme'
import type { LegendCorner } from '@shared/svg/legendPlacement'
import {
  collectIconRefs,
  defaultLegendItems,
  iconKey,
  renderDiagramSvg,
  type IconAsset
} from '@shared/svg/renderDiagram'
import { loadBuiltinIconSvg } from '../icons/builtinIcons'

export interface SvgExportParams {
  theme: Theme
  paddingPx: number
  transparentBackground: boolean
  // The fill when not transparent: the canvas's own background (the dialog previews it) or the colour
  // picked in the dialog.
  backgroundColorHex: string
  legendCorner: LegendCorner
  enabledHighlightIds: string[]
  edgeStraightSegmentLength: number
  diagramPath: string | null
  title?: string
}

// Resolves every icon the diagram draws, then renders. Built-in icons are bundled markup, drawn
// inline; a custom icon comes over as a data URL, drawn as an <image> (never inlined, since a
// user-supplied SVG may contain script). An icon that cannot be read is left out, not fatal.
export async function buildDiagramSvg(
  diagram: DiagramFile,
  params: SvgExportParams
): Promise<string> {
  const legendItems = defaultLegendItems(diagram, params.enabledHighlightIds)
  const icons = new Map<string, IconAsset>()
  await Promise.all(
    collectIconRefs(diagram, legendItems).map(async (icon) => {
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
  return renderDiagramSvg(diagram, {
    theme: params.theme,
    paddingPx: params.paddingPx,
    background: params.transparentBackground ? 'transparent' : { color: params.backgroundColorHex },
    legend:
      legendItems.length > 0 ? { items: legendItems, corner: params.legendCorner } : undefined,
    enabledHighlightIds: params.enabledHighlightIds,
    edgeStraightSegmentLength: params.edgeStraightSegmentLength,
    icons,
    title: params.title
  })
}
