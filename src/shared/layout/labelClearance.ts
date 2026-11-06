// Edge labels that do not fit in the gap between the two elements their edge joins, with the line and
// its end graphics still visible either side of them (ADR 0146). One implementation for everything that checks
// this: `chd validate` and the Claude Desktop extension run it through the skill's script, which gets
// a generated copy of this file (scripts/build-cli.mjs), and the app's Diagnostics panel imports it.
//
// The width of the text comes from the same per-character estimate the SVG export wraps with
// (export/textLayout.ts, ADR 0124), because no font file is available to a command-line check and an
// estimate gives the same answer on every computer. The chip around the text is the one the canvas
// and the export draw: 12px of padding and border across, 4px down, at the edge's label position.
//
// The inputs are what a parsed .chd holds, not yet validated, so every field is read defensively.
import { LINE_HEIGHT_EM, measureText, wrapText, type FontSpec } from '../export/textLayout.ts'
import { EDGE_STYLE_DEFAULTS } from '../styling/styleDefaults.ts'

export interface ClearanceNode {
  id?: unknown
  type?: unknown
  parentId?: unknown
  position?: { x?: unknown; y?: unknown } | null
  size?: { width?: unknown; height?: unknown } | null
}

export interface ClearanceEdge {
  id?: unknown
  source?: unknown
  target?: unknown
  label?: unknown
  sourceHandle?: unknown
  targetHandle?: unknown
  points?: unknown
  style?: {
    fontSize?: unknown
    fontWeight?: unknown
    fontFamily?: unknown
    labelPosition?: unknown
    startMarker?: unknown
    endMarker?: unknown
  } | null
}

export interface HiddenLabel {
  edgeId: string
  label: string
  sourceId: string
  targetId: string
  // The clear space between the two elements, and what the label needs, along the direction the edge runs.
  gap: number
  needed: number
  horizontal: boolean
}

interface Rect {
  x: number
  y: number
  width: number
  height: number
}

// The line that must show between the chip and an element, per end graphic on that side, for the edge
// to read as one. Set by eye in the app, from the smallest gap at which a label centred on an edge with
// the same graphic at both ends looked acceptable, with the default 12px label: half of the gap left
// beside the chip. Nothing is drawn for 'none', so it needs the least; a crow's foot with a zero ring is
// the largest graphic.
export const MARKER_LINE_PX: Readonly<Record<string, number>> = {
  none: 8,
  arrowOpen: 12,
  arrowClosed: 12,
  circle: 12,
  circleFilled: 11,
  diamond: 12,
  diamondFilled: 11,
  crowsFootOne: 5,
  crowsFootMany: 15,
  crowsFootOneOrMany: 17,
  crowsFootZeroOrOne: 12,
  crowsFootZeroOrMany: 18
}
const UNKNOWN_MARKER_LINE_PX = 12

// A label slid towards one end leaves line on the far side to show what the edge is; the near side only
// has to keep the chip clear of the element. Set by eye in the app: 3px or more looked acceptable.
const NEAR_SIDE_LINE_PX = 3
// A label within this of the middle (0.5) is judged as centred, so a nudge never lowers the need.
const CENTRED_TOLERANCE = 0.05
// The line to leave either side of a centred label so the edge reads as solid, dashed or dotted, as
// well as being there. Set by eye in the app.
const TARGET_LINE_PX = 20

// The chip's own padding and border: 6px + 1px each side across, 1px + 1px each side down.
const CHIP_ACROSS_PX = 14
const CHIP_DOWN_PX = 4
const CHIP_MIN_TEXT_PX = 8

const PLAIN_SIDES = new Set(['left', 'right', 'top', 'bottom'])

const isNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value)
const roundUp = (px: number): number => Math.ceil(Number(px.toFixed(2)))

function labelFont(edge: ClearanceEdge, diagramFont: string | undefined): FontSpec {
  const style = edge.style ?? {}
  const family =
    typeof style.fontFamily === 'string' && style.fontFamily.trim() !== ''
      ? style.fontFamily
      : diagramFont
  return {
    size: isNumber(style.fontSize) ? style.fontSize : EDGE_STYLE_DEFAULTS.fontSize,
    weight: style.fontWeight === 'bold' ? 'bold' : EDGE_STYLE_DEFAULTS.fontWeight,
    family
  }
}

// How wide and high the chip of a label is, in px.
export function labelChipSize(label: string, font: FontSpec): { width: number; height: number } {
  const lines = wrapText(label, 0, font)
  const textWidth = Math.max(0, ...lines.map((line) => measureText(line, font)))
  const lineHeight = font.size * LINE_HEIGHT_EM
  return {
    width: Math.max(CHIP_MIN_TEXT_PX, textWidth) + CHIP_ACROSS_PX,
    height: Math.max(font.size, lines.length * lineHeight) + CHIP_DOWN_PX
  }
}

export interface LabelEnds {
  // The edge's own end graphics; absent means the defaults of a new edge (no graphic at the start, a
  // closed arrow at the end).
  startMarker?: unknown
  endMarker?: unknown
  // How far along the edge from its source the label sits (0 to 1); absent means 0.5, the middle.
  position?: number
}

const markerLine = (marker: unknown): number =>
  typeof marker === 'string' && marker in MARKER_LINE_PX
    ? MARKER_LINE_PX[marker]
    : UNKNOWN_MARKER_LINE_PX

// The gap worth leaving for a centred label: the chip plus the target line either side. Guidance; the
// minimum above is what is checked.
export function labelTargetGap(label: string, font: FontSpec, horizontal: boolean): number {
  const chip = labelChipSize(label, font)
  return roundUp((horizontal ? chip.width : chip.height) + 2 * TARGET_LINE_PX)
}

// The gap an edge label needs, in px, along the direction its edge runs. Centred, it is the chip plus the
// line its larger end graphic needs on each side. Slid towards one end, each side is judged on its own:
// the nearer side only has to keep the chip off the element, the farther one keeps its end graphic.
export function labelNeededGap(
  label: string,
  font: FontSpec,
  horizontal: boolean,
  ends: LabelEnds = {}
): number {
  const chip = labelChipSize(label, font)
  const size = horizontal ? chip.width : chip.height
  const start = markerLine(ends.startMarker ?? EDGE_STYLE_DEFAULTS.startMarker)
  const end = markerLine(ends.endMarker ?? EDGE_STYLE_DEFAULTS.endMarker)
  const position = Math.min(0.98, Math.max(0.02, ends.position ?? 0.5))
  if (Math.abs(position - 0.5) <= CENTRED_TOLERANCE) {
    return roundUp(size + 2 * Math.max(start, end))
  }
  // The chip's centre is `position` of the way along the gap, so a side of length s needs a gap of
  // (s + half the chip) / its share of the gap.
  const slidToSource = position < 0.5
  const sourceSide = slidToSource ? NEAR_SIDE_LINE_PX : start
  const targetSide = slidToSource ? end : NEAR_SIDE_LINE_PX
  return roundUp(
    Math.max((sourceSide + size / 2) / position, (targetSide + size / 2) / (1 - position))
  )
}

// The edges whose label does not fit in the gap, so it is partly hidden behind the elements or leaves
// too little of the line to read.
// Left out because the gap cannot be judged: an edge with bend points (the chip's place is not along
// the gap), a label position outside the edge, a text-only line, an edge between a container and its
// own content, overlapping elements, and an edge that leaves by the far side of an element (it loops
// round).
// `diagramFont` is the diagram's own font, which an edge label inherits (ADR 0130).
export function hiddenLabels(
  nodes: readonly ClearanceNode[],
  edges: readonly ClearanceEdge[],
  diagramFont?: string
): HiddenLabel[] {
  const byId = new Map<unknown, ClearanceNode>()
  for (const node of nodes) if (node && node.id !== undefined) byId.set(node.id, node)
  const parentOf = (n: ClearanceNode): ClearanceNode | undefined =>
    n.parentId === undefined ? undefined : byId.get(n.parentId)
  const isInside = (n: ClearanceNode, ancestorId: unknown): boolean => {
    for (let p = parentOf(n), hops = 0; p && hops < 100; p = parentOf(p), hops += 1) {
      if (p.id === ancestorId) return true
    }
    return false
  }
  // Absolute position: a child's `position` is relative to its parent container.
  const rectOf = (n: ClearanceNode): Rect | null => {
    let x = n.position?.x
    let y = n.position?.y
    const width = n.size?.width
    const height = n.size?.height
    if (!isNumber(x) || !isNumber(y) || !isNumber(width) || !isNumber(height)) return null
    for (let p = parentOf(n), hops = 0; p && hops < 100; p = parentOf(p), hops += 1) {
      if (!isNumber(p.position?.x) || !isNumber(p.position?.y)) return null
      x += p.position.x
      y += p.position.y
    }
    return { x, y, width, height }
  }

  const found: HiddenLabel[] = []
  for (const edge of edges) {
    if (!edge || typeof edge.label !== 'string' || edge.label.trim() === '') continue
    if (Array.isArray(edge.points) && edge.points.length > 0) continue
    const labelPosition = edge.style?.labelPosition
    if (
      labelPosition !== undefined &&
      !(isNumber(labelPosition) && labelPosition > 0 && labelPosition < 1)
    )
      continue
    const a = byId.get(edge.source)
    const b = byId.get(edge.target)
    if (!a || !b || a === b || a.type === 'line' || b.type === 'line') continue
    if (isInside(a, b.id) || isInside(b, a.id)) continue
    const ra = rectOf(a)
    const rb = rectOf(b)
    if (!ra || !rb) continue

    const gapX = Math.max(rb.x - (ra.x + ra.width), ra.x - (rb.x + rb.width))
    const gapY = Math.max(rb.y - (ra.y + ra.height), ra.y - (rb.y + rb.height))
    if (gapX <= 0 && gapY <= 0) continue // overlapping elements: a different problem
    const horizontal = gapX > 0 && (gapY <= 0 || gapX >= gapY)
    const gap = horizontal ? gapX : gapY
    // An edge that leaves by the far side of an element loops round it: the label is not in the gap.
    const aIsFirst = horizontal ? ra.x < rb.x : ra.y < rb.y
    const [firstSide, secondSide] = horizontal ? ['right', 'left'] : ['bottom', 'top']
    const faces = (handle: unknown, isFirst: boolean): boolean =>
      typeof handle !== 'string' ||
      !PLAIN_SIDES.has(handle) ||
      handle === (isFirst ? firstSide : secondSide)
    if (!faces(edge.sourceHandle, aIsFirst) || !faces(edge.targetHandle, !aIsFirst)) continue

    const needed = labelNeededGap(edge.label, labelFont(edge, diagramFont), horizontal, {
      startMarker: edge.style?.startMarker,
      endMarker: edge.style?.endMarker,
      position: isNumber(labelPosition) ? labelPosition : undefined
    })
    if (gap < needed) {
      found.push({
        edgeId: String(edge.id ?? '?'),
        label: edge.label.trim(),
        sourceId: String(a.id),
        targetId: String(b.id),
        gap,
        needed,
        horizontal
      })
    }
  }
  return found
}
