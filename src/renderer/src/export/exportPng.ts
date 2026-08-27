import { toPng } from 'html-to-image'
import { getNodesBounds, type Node } from '@xyflow/react'
import { resolveLegendIconMarkup, resolveLegendColors, buildLegendElement } from './exportLegendDom'
import { placeLegend, type LegendCorner, type Rect } from './exportLegendPlacement'
import type { ExportLegendItem } from './exportLegendItems'

export interface PngExportOptions {
  paddingPx: number
  transparentBackground: boolean
  // Explicit fill color, distinct from whatever's on screen right now
  // (canvasBackgroundColor/theme default) — absent falls back to that.
  // Ignored when transparentBackground is true.
  backgroundColorOverride?: string
  // Absent or an empty items array means no legend at all — same as
  // today's export before this existed.
  legend?: {
    items: ExportLegendItem[]
    corner: LegendCorner
    diagramPath: string | null
  }
}

// Legend inset from whichever corner it's placed in/against — independent
// of paddingPx (the diagram-content margin), so shrinking padding to 0
// doesn't jam the legend flush against the diagram's own edge.
const LEGEND_MARGIN = 16

// A fixed oversample factor for export sharpness — not exposed as a
// setting (only padding/transparent background were asked for), just
// a sensible default so a PNG dropped into Confluence isn't visibly
// blurrier than the on-screen canvas.
const PIXEL_RATIO = 2

// Walks up from a starting element until it finds a real (non-transparent)
// computed background-color — the same way a browser visually composites
// "what color is actually behind this," not a literal CSS-variable lookup.
// Needed because .react-flow's own background-color rule
// (node_modules/@xyflow/react/dist/style.css) resolves through
// var(--xy-background-color, var(--xy-background-color-default)), and its
// *light-theme* default is literally `transparent` — reading the
// --xy-background-color custom property directly (an earlier version of
// this function did) returns an empty string whenever no custom
// canvasBackgroundColor is set, which is the common case, silently always
// falling back to a hardcoded white rather than whatever's actually
// painted behind the canvas (found live, 2026-08-23 — "Use canvas color"
// exported plain white regardless of the real on-screen color). In light
// mode with no override, that real color comes from this app's own
// `body { background: var(--color-background) }` (assets/base.css),
// several ancestors above .react-flow itself — walking up the DOM and
// reading the browser's own already-resolved `background-color` at each
// level sidesteps needing to know which ancestor happens to own it.
export function resolveEffectiveBackgroundColor(start: HTMLElement): string {
  let current: HTMLElement | null = start
  while (current) {
    const color = getComputedStyle(current).backgroundColor
    if (color && color !== 'transparent' && color !== 'rgba(0, 0, 0, 0)') return color
    current = current.parentElement
  }
  return '#ffffff'
}

// <input type="color"> only accepts #rrggbb — silently ignoring (resetting
// to black) anything else, notably the rgb()/rgba() strings
// getComputedStyle actually returns. Needed so ExportPngDialog can preview
// resolveEffectiveBackgroundColor's real result in its color swatch
// instead of a hardcoded placeholder (found live, 2026-08-23 — the dialog
// kept showing white regardless of the diagram's actual background, even
// after the export itself started using the right color).
export function rgbStringToHex(rgb: string): string {
  const match = rgb.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/)
  if (!match) return '#ffffff'
  const toHex = (channel: string): string => Number(channel).toString(16).padStart(2, '0')
  return `#${toHex(match[1])}${toHex(match[2])}${toHex(match[3])}`
}

// Captures the diagram's own content — cropped to nodes' bounds plus
// paddingPx, at zoom 1 regardless of the window's current viewport/zoom —
// as a PNG data URL. viewportEl must be the `.react-flow__viewport`
// element: it contains only nodes/edges, not Background/Controls/MiniMap
// (siblings in React Flow's own DOM, positioned outside it), so capturing
// it directly needs no extra hiding of editor chrome. Selection outlines
// and resize/connection-point handles are a separate concern the caller
// handles (deselecting before capture) since they render conditionally
// inside each node's own DOM, not something this function can see from
// the outside.
export async function captureDiagramPng(
  nodes: Node[],
  edges: { source: string; target: string }[],
  viewportEl: HTMLElement,
  options: PngExportOptions
): Promise<string> {
  let bounds: Rect = getNodesBounds(nodes)

  // Built and measured before touching width/height/translate below — a
  // legend that needs the canvas extended (placeLegend, exportLegendPlacement.ts)
  // changes `bounds` itself, so the export's own dimensions have to be
  // computed after this, not before.
  let legendEl: HTMLDivElement | undefined
  if (options.legend && options.legend.items.length > 0) {
    // .canvas-view-flow (Canvas.tsx) sits outside .react-flow__viewport's
    // own pan/zoom transform — measuring there instead of inside the live
    // viewport gets the legend's true 1:1 world-space size regardless of
    // the window's current zoom level (getBoundingClientRect reports
    // already-zoomed size for anything actually inside the transformed
    // viewport).
    const measureParent = viewportEl.closest<HTMLElement>('.canvas-view-flow') ?? document.body
    const iconMarkup = await resolveLegendIconMarkup(
      options.legend.items,
      options.legend.diagramPath
    )
    const colors = resolveLegendColors(measureParent)
    legendEl = buildLegendElement(options.legend.items, iconMarkup, colors)

    legendEl.style.position = 'fixed'
    legendEl.style.visibility = 'hidden'
    legendEl.style.left = '-99999px'
    legendEl.style.top = '-99999px'
    measureParent.appendChild(legendEl)
    const measured = legendEl.getBoundingClientRect()
    measureParent.removeChild(legendEl)

    // Obstacles: every node's own bounds, plus a coarse per-edge box (the
    // union of its two endpoint nodes' bounds — an approximation, not the
    // rendered path itself; a heavily curved/waypointed edge could in
    // principle still graze the legend undetected, but this covers the
    // common case cheaply without sampling actual edge geometry).
    const nodeObstacles = nodes.map((n) => getNodesBounds([n]) as Rect)
    const nodeById = new Map(nodes.map((n) => [n.id, n]))
    const edgeObstacles: Rect[] = []
    for (const e of edges) {
      const source = nodeById.get(e.source)
      const target = nodeById.get(e.target)
      if (source && target) edgeObstacles.push(getNodesBounds([source, target]) as Rect)
    }

    const placement = placeLegend(
      bounds,
      { width: measured.width, height: measured.height },
      options.legend.corner,
      LEGEND_MARGIN,
      [...nodeObstacles, ...edgeObstacles]
    )
    bounds = placement.bounds

    legendEl.style.position = 'absolute'
    legendEl.style.visibility = 'visible'
    legendEl.style.left = '0'
    legendEl.style.top = '0'
    legendEl.style.transform = `translate(${placement.position.x}px, ${placement.position.y}px)`
  }

  const padding = options.paddingPx
  const width = Math.ceil(bounds.width + padding * 2)
  const height = Math.ceil(bounds.height + padding * 2)
  const translateX = padding - bounds.x
  const translateY = padding - bounds.y

  const backgroundColor = options.transparentBackground
    ? undefined
    : (options.backgroundColorOverride ?? resolveEffectiveBackgroundColor(viewportEl))

  // Edge arrow/marker <defs> (EdgeMarkerDefs) live in a separate, zero-size
  // <svg> outside .react-flow__viewport, so every marker-end="url(#...)"
  // reference on an edge path would otherwise dangle in this function's
  // cloned-subtree capture, leaving arrowheads invisible in the exported
  // PNG (found live, 2026-08-23). Cloning it in for the duration of the
  // capture (rather than moving the real node) avoids disturbing React's
  // own DOM bookkeeping for that element. The legend's own 'line'-kind
  // swatches (exportLegendDom.ts) reference the same marker ids, so this
  // one clone covers both.
  const markerDefs = document.querySelector('[data-export-role="edge-marker-defs"]')
  const markerDefsClone = markerDefs?.cloneNode(true) as ChildNode | undefined
  if (markerDefsClone) viewportEl.insertBefore(markerDefsClone, viewportEl.firstChild)
  if (legendEl) viewportEl.appendChild(legendEl)

  try {
    return await toPng(viewportEl, {
      width,
      height,
      pixelRatio: PIXEL_RATIO,
      backgroundColor,
      style: {
        width: `${width}px`,
        height: `${height}px`,
        transform: `translate(${translateX}px, ${translateY}px)`
      }
    })
  } finally {
    if (markerDefsClone) viewportEl.removeChild(markerDefsClone)
    if (legendEl) viewportEl.removeChild(legendEl)
  }
}
