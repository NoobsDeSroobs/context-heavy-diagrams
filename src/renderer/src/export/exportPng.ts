import { toPng } from 'html-to-image'
import { getNodesBounds, type Node } from '@xyflow/react'
import { resolveLegendIconMarkup, resolveLegendColors, buildLegendElement } from './exportLegendDom'
import { placeLegend, type LegendCorner, type Rect } from './exportLegendPlacement'
import type { ExportLegendItem } from './exportLegendItems'
import { MARKER_ID } from '../edges/markerIds'

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

// This app's own edge markers (edgeMarkers.tsx) use the SVG `context-fill`/
// `context-stroke` paint keywords so one marker def can be referenced by
// edges of any color, each rendering the marker in its own live stroke
// color. That works fine on screen but not through html-to-image's toPng():
// a <marker>'s content is template content, never actually part of the
// normal painted tree, so the "which element referenced me, and what's its
// stroke" relationship context-stroke depends on doesn't survive
// html-to-image's own DOM-to-image conversion — arrowheads render with no
// visible color at all in the exported PNG (found live, 2026-09-15;
// swapping which marker got referenced by default, a first attempted fix,
// didn't help, since both this app's and React Flow's own default marker
// used to point at the same underlying mechanism once that first change
// landed — the real gap was context-stroke itself, not which def was used).
//
// Selection/hover-driven marker color doesn't need to survive export
// (selection is already cleared before capture, same as the resize/
// connection-point handles this function's own doc comment already notes
// as a separate concern), so this only ever needs each edge's *current*
// resolved color, not full CSS-var dynamism — resolving that ahead of time
// into one literal-color marker clone per distinct color actually in use
// (exactly how React Flow's own built-in markers already work) sidesteps
// the whole context-* reliability question for export specifically,
// without touching how markers render live.
//
// Operates on viewportEl directly (the live, connected tree) for the
// duration of the capture, then restores every attribute it touched — same
// pattern as the marker-defs clone below, chosen for the same reason
// (moving/mutating the live React-managed edge nodes themselves, rather
// than a append-only sibling clone, would be riskier; this instead only
// ever restores exactly what it changed, synchronously, before any
// re-render could observe the mutated state).
function resolveMarkersForExport(viewportEl: HTMLElement): () => void {
  const CHD_MARKER_IDS = new Set(Object.values(MARKER_ID))
  const defs = viewportEl.querySelector('[data-export-role="edge-marker-defs"] defs')
  if (!defs) return () => {}

  const markerIdFromUrl = (value: string | null): string | null =>
    value?.match(/^url\(#([^)]+)\)$/)?.[1] ?? null

  const variantIds = new Map<string, string>() // `${baseId}::${color}` -> variant id
  const ensureVariant = (baseId: string, color: string): string | null => {
    const cacheKey = `${baseId}::${color}`
    const cached = variantIds.get(cacheKey)
    if (cached) return cached
    const original = defs.querySelector(`#${CSS.escape(baseId)}`)
    if (!original) return null
    const clone = original.cloneNode(true) as Element
    const variantId = `${baseId}__export-${variantIds.size}`
    clone.setAttribute('id', variantId)
    clone
      .querySelectorAll('[fill="context-stroke"]')
      .forEach((el) => el.setAttribute('fill', color))
    clone
      .querySelectorAll('[stroke="context-stroke"]')
      .forEach((el) => el.setAttribute('stroke', color))
    defs.appendChild(clone)
    variantIds.set(cacheKey, variantId)
    return variantId
  }

  // Not scoped to .react-flow__edge-path — the legend's own 'line'-kind
  // swatches (exportLegendDom.ts) reference these same marker ids via a
  // plain <line>, appended into viewportEl for the capture same as edges,
  // and need the identical treatment.
  const restores: (() => void)[] = []
  viewportEl.querySelectorAll<SVGElement>('[marker-end], [marker-start]').forEach((el) => {
    const color = getComputedStyle(el).stroke
    ;(['marker-start', 'marker-end'] as const).forEach((attr) => {
      const raw = el.getAttribute(attr)
      const baseId = markerIdFromUrl(raw)
      if (!baseId || !CHD_MARKER_IDS.has(baseId)) return
      const variantId = ensureVariant(baseId, color)
      if (!variantId) return
      el.setAttribute(attr, `url(#${variantId})`)
      restores.push(() => el.setAttribute(attr, raw as string))
    })
  })

  return () => restores.forEach((restore) => restore())
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
  // Needs the clone's own <defs> in place first — see resolveMarkersForExport's
  // own comment for why context-stroke needs resolving to literal colors here.
  const restoreMarkers = markerDefsClone ? resolveMarkersForExport(viewportEl) : () => {}

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
    restoreMarkers()
    if (markerDefsClone) viewportEl.removeChild(markerDefsClone)
    if (legendEl) viewportEl.removeChild(legendEl)
  }
}
