import type { DiagramFile } from '@shared/diagram'
import type { Theme } from '@shared/styling/theme'
import type { LegendCorner } from '@shared/legend/legendPlacement'
import type { PortalMarkKind } from '@shared/portals/portals'
import {
  collectIconRefs,
  defaultLegendItems,
  iconKey,
  renderDiagramSvg,
  type IconAsset
} from '@shared/export/renderDiagram'
import { loadIconAsset } from './iconAssets'

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
  // The font the app draws this diagram in, when the diagram has none of its own (ADR 0130).
  fontFamily?: string
  // Gates where an edge goes through the border of a container, as on the canvas (ADR 0185).
  crossings?: boolean
  // How a portal's gap is marked, the person's preference.
  portalMark?: PortalMarkKind
}

// Resolves every icon the diagram draws, then renders. A pack's icon is cleaned markup, drawn
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
      const asset = await loadIconAsset(icon, params.diagramPath)
      if (asset) icons.set(iconKey(icon), asset)
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
    fontFamily: params.fontFamily,
    title: params.title,
    crossings: params.crossings,
    portalMark: params.portalMark
  })
}
