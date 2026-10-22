import { toPng } from 'html-to-image'
import { getNodesBounds, type Node } from '@xyflow/react'
import {
  resolveLegendIconMarkup,
  resolveLegendColors,
  buildLegendElement
} from '../legend/exportLegendDom'
import { placeLegend, type LegendCorner, type Rect } from '@shared/legend/legendPlacement'
import type { ExportLegendItem } from '@shared/legend/legendItems'
import { MARKER_ID } from '../edges/markerIds'
import { MARKER_SHAPES } from '@shared/export/markerShapes'

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

// Walks up from a starting element to the first real (non-transparent) computed background-color,
// the way a browser composites "what is actually behind this", not a CSS-variable lookup.
// .react-flow's background resolves through var(--xy-background-color,
// var(--xy-background-color-default)) (node_modules/@xyflow/react/dist/style.css) and its
// light-theme default is literally `transparent`, so reading --xy-background-color directly returns
// an empty string when no canvasBackgroundColor is set (the common case) and silently fell back to
// white: "Use canvas color" exported white regardless of what was on screen. In light mode that
// real colour comes from `body { background: var(--color-background) }` (assets/base.css), several
// ancestors above .react-flow; reading the browser's resolved `background-color` at each level
// avoids knowing which ancestor owns it.
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
// getComputedStyle actually returns. Needed so ExportImageDialog can preview
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

// This app's edge markers (edgeMarkers.tsx) use the SVG `context-fill`/`context-stroke` keywords so
// one marker def serves edges of any colour. That works on screen but not through html-to-image's
// toPng(): a <marker>'s content is template content, outside the normal painted tree, so the "which
// element referenced me, and what's its stroke" relationship context-stroke needs doesn't survive
// the DOM-to-image conversion, and arrowheads export with no visible colour. (Swapping which marker
// is referenced by default didn't help; the gap is context-stroke itself.)
//
// Selection and hover colours needn't survive export (selection is cleared before capture), so only
// each edge's current resolved colour is needed. Resolving it ahead of time into one literal-colour
// marker clone per colour in use, as React Flow's built-in markers work, avoids the context-*
// question for export without touching live rendering.
//
// Operates on viewportEl directly for the duration of the capture, then restores every attribute it
// touched, synchronously, before any re-render could observe the mutation. Same pattern as the
// marker-defs clone below: mutating the live React-managed edge nodes is riskier than an
// append-only sibling clone, so it restores exactly what it changed.
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

// How far an arrowhead can reach to the side of the line it sits on, in stroke widths (markers are
// sized in stroke-width units).
const MARKER_HALF_SPAN = Math.max(
  ...Object.values(MARKER_SHAPES).map((m) => Math.max(m.markerWidth, m.markerHeight) / 2)
)

// Grows `base` to also contain every drawn edge and edge label under viewportEl, so an edge whose
// route runs past the outermost node is not cropped out of the export. The edge paths are measured
// as drawn (getBBox is in flow coordinates, inside the viewport's pan/zoom transform), not
// rebuilt from the stored points: a curved or orthogonal route can bulge beyond its bend points.
// A path's stroke and any arrowhead are not part of getBBox, so a margin for them is added.
// Labels are positioned HTML, so they are measured on screen and converted to flow coordinates.
export function includeEdgesInBounds(base: Rect, viewportEl: HTMLElement): Rect {
  let minX = base.x
  let minY = base.y
  let maxX = base.x + base.width
  let maxY = base.y + base.height
  const add = (x1: number, y1: number, x2: number, y2: number): void => {
    minX = Math.min(minX, x1)
    minY = Math.min(minY, y1)
    maxX = Math.max(maxX, x2)
    maxY = Math.max(maxY, y2)
  }

  viewportEl.querySelectorAll<SVGPathElement>('path.react-flow__edge-path').forEach((path) => {
    if (!path.getAttribute('d')) return
    const box = path.getBBox()
    const strokeWidth = parseFloat(getComputedStyle(path).strokeWidth) || 1
    const hasMarker = path.hasAttribute('marker-start') || path.hasAttribute('marker-end')
    const margin = strokeWidth / 2 + (hasMarker ? MARKER_HALF_SPAN * strokeWidth : 0)
    add(box.x - margin, box.y - margin, box.x + box.width + margin, box.y + box.height + margin)
  })

  const viewportBox = viewportEl.getBoundingClientRect()
  const scale = new DOMMatrixReadOnly(getComputedStyle(viewportEl).transform).a || 1
  viewportEl.querySelectorAll<HTMLElement>('.edge-label').forEach((label) => {
    if (!label.textContent?.trim()) return
    const box = label.getBoundingClientRect()
    add(
      (box.left - viewportBox.left) / scale,
      (box.top - viewportBox.top) / scale,
      (box.right - viewportBox.left) / scale,
      (box.bottom - viewportBox.top) / scale
    )
  })

  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
}

// Captures the diagram's content, cropped to the nodes' and edges' bounds plus paddingPx at zoom 1 regardless
// of the current viewport, as a PNG data URL. viewportEl must be `.react-flow__viewport`: it holds
// only nodes and edges, not Background/Controls/MiniMap (its siblings), so no editor chrome needs
// hiding. Selection outlines and resize/connection-point handles render conditionally inside each
// node, which this function can't see from outside, so the caller deselects before capture.
export async function captureDiagramPng(
  nodes: Node[],
  edges: { source: string; target: string }[],
  viewportEl: HTMLElement,
  options: PngExportOptions
): Promise<string> {
  let bounds: Rect = includeEdgesInBounds(getNodesBounds(nodes), viewportEl)

  // Built and measured before touching width/height/translate below — a
  // legend that needs the canvas extended (placeLegend, legendPlacement.ts)
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

  // The edge marker <defs> (EdgeMarkerDefs) live in a separate zero-size <svg> outside
  // .react-flow__viewport, so every marker-end="url(#...)" on an edge path would dangle in this
  // function's cloned-subtree capture and arrowheads would be invisible in the PNG. Cloning it in
  // for the capture, rather than moving the real node, avoids disturbing React's DOM bookkeeping.
  // The legend's 'line' swatches (exportLegendDom.ts) reference the same marker ids, so one clone
  // covers both.
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
