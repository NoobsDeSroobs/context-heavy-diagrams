// Edge labels that are wider (or higher) than the gap between the two elements their edge joins, so
// the label is drawn partly behind them (ADR 0146). One implementation for everything that checks
// this: `chd validate` and the Claude Desktop extension run it through the skill's script, which gets
// a generated copy of this file (scripts/build-cli.mjs), and the app's Diagnostics panel imports it.
//
// The width of the text comes from the same per-character estimate the SVG export wraps with
// (export/textLayout.ts, ADR 0124), because no font file is available to a command-line check and an
// estimate gives the same answer on every computer. The chip around the text is the one the canvas
// and the export draw: 12px of padding and border across, 4px down, centred on the edge's midpoint.
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

// The edges whose label certainly does not fit in the gap, so it is partly hidden behind the elements.
// Left out because the chip is not in the middle of the gap or the gap cannot be judged: an edge with
// bend points or a moved label, a text-only line, an edge between a container and its own content,
// overlapping elements, and an edge that leaves by the far side of an element (it loops round).
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
    const position = edge.style?.labelPosition
    if (position !== undefined && position !== 0.5) continue
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

    const chip = labelChipSize(edge.label, labelFont(edge, diagramFont))
    const needed = roundUp(horizontal ? chip.width : chip.height)
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
