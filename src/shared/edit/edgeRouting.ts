// What is wrong with the edges of a diagram as they are drawn: an edge over an element it does not
// join, two edges crossing, and an edge label sitting on an element, on another edge, on another
// label, on a container's wall or on its title (ADR 0161). It judges the path the canvas and the SVG export draw (buildEdgePath), curves,
// bend points and routing style included, not a straight line between the two ends.
import type { DiagramFile } from '../diagram/index.ts'
import {
  DEFAULT_FONT_FAMILY,
  resolveBoxLook,
  resolveEdgeLabelLook,
  resolveLabelLook
} from '../export/appearance.ts'
import {
  layoutEdges,
  layoutNodes,
  orientEdges,
  type LaidOutEdge,
  type LaidOutNode
} from '../export/model.ts'
import { buildEdgePath } from '../geometry/edgePath.ts'
import { flattenPath, pointAtRatio, type Point } from '../geometry/pathSampling.ts'
import { labelChipSize } from '../layout/labelClearance.ts'
import { LINE_HEIGHT_EM, measureText, wrapText } from '../export/textLayout.ts'
import { DEFAULT_PREFERENCES } from '../preferences/preferences.ts'

export interface EdgeIssue {
  kind:
    | 'edge-through-element'
    | 'edge-crossing'
    | 'label-over-element'
    | 'label-over-edge'
    | 'label-over-label'
    | 'label-over-container-title'
    | 'label-on-container-border'
  message: string
  ids: string[]
}

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

interface DrawnEdge {
  laid: LaidOutEdge
  id: string
  path: Point[]
  box: Rect
  // The label chip, when the edge has a label.
  chip?: Rect
}

// Does the straight segment p-q pass through the rectangle? (Liang-Barsky clipping.)
export function segmentHits(p: Point, q: Point, r: Rect): boolean {
  let t0 = 0
  let t1 = 1
  const dx = q.x - p.x
  const dy = q.y - p.y
  const checks: [number, number][] = [
    [-dx, p.x - r.x],
    [dx, r.x + r.width - p.x],
    [-dy, p.y - r.y],
    [dy, r.y + r.height - p.y]
  ]
  for (const [d, dist] of checks) {
    if (d === 0) {
      if (dist < 0) return false
    } else {
      const t = dist / d
      if (d < 0) {
        if (t > t1) return false
        if (t > t0) t0 = t
      } else {
        if (t < t0) return false
        if (t < t1) t1 = t
      }
    }
  }
  return t0 < t1
}

const pathHits = (path: Point[], r: Rect): boolean => {
  for (let i = 1; i < path.length; i += 1) if (segmentHits(path[i - 1], path[i], r)) return true
  return false
}

const shrink = (r: Rect, by: number): Rect => ({
  x: r.x + by,
  y: r.y + by,
  width: Math.max(r.width - 2 * by, 0),
  height: Math.max(r.height - 2 * by, 0)
})

const boxOf = (path: Point[]): Rect => {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const p of path) {
    minX = Math.min(minX, p.x)
    minY = Math.min(minY, p.y)
    maxX = Math.max(maxX, p.x)
    maxY = Math.max(maxY, p.y)
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
}

const boxesTouch = (a: Rect, b: Rect): boolean =>
  a.x <= b.x + b.width && b.x <= a.x + a.width && a.y <= b.y + b.height && b.y <= a.y + a.height

// How far two rectangles overlap along each axis (negative: apart).
const overlapOf = (a: Rect, b: Rect): { x: number; y: number } => ({
  x: Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x),
  y: Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y)
})

// Where the segments a-b and c-d cross, if they do.
function crossingPoint(a: Point, b: Point, c: Point, d: Point): Point | null {
  const r = { x: b.x - a.x, y: b.y - a.y }
  const s = { x: d.x - c.x, y: d.y - c.y }
  const denominator = r.x * s.y - r.y * s.x
  if (denominator === 0) return null
  const t = ((c.x - a.x) * s.y - (c.y - a.y) * s.x) / denominator
  const u = ((c.x - a.x) * r.y - (c.y - a.y) * r.x) / denominator
  // Half-open, so a crossing exactly at a vertex of both paths is found once, on the segment
  // that starts there.
  if (t < 0 || t >= 1 || u < 0 || u >= 1) return null
  return { x: a.x + t * r.x, y: a.y + t * r.y }
}

// A label on one line, cut short: element labels can be several lines or a paragraph.
const shortName = (text: string): string => {
  const line = text.replace(/\s+/g, ' ').trim()
  return line.length > 40 ? `${line.slice(0, 39)}…` : line
}

// Edges that share a connection point meet there and fan out: a crossing this close to an end of
// both is that meeting, not a crossing. They share the straight lead-in too, so it is that long
// plus a margin.
const LEAD_IN_PX = DEFAULT_PREFERENCES.edgeStraightSegmentLength
const SHARED_END_PX = LEAD_IN_PX + 4
// A label closer than this to a container's wall counts as sitting on it.
const WALL_BAND_PX = 3
// An overlap of a pixel is rounding; the layout check for elements uses the same.
const OVERLAP_PX = 1
// How far inside an element's border an edge must reach to count as running over it.
const EDGE_INSET_PX = 2

function firstCrossing(a: DrawnEdge, b: DrawnEdge): Point | null {
  const ends = [a.path[0], a.path[a.path.length - 1], b.path[0], b.path[b.path.length - 1]]
  const near = (p: Point, q: Point): boolean => Math.hypot(p.x - q.x, p.y - q.y) < SHARED_END_PX
  for (let i = 1; i < a.path.length; i += 1) {
    for (let j = 1; j < b.path.length; j += 1) {
      const at = crossingPoint(a.path[i - 1], a.path[i], b.path[j - 1], b.path[j])
      if (!at) continue
      if ((near(at, ends[0]) || near(at, ends[1])) && (near(at, ends[2]) || near(at, ends[3]))) {
        continue
      }
      return at
    }
  }
  return null
}

// `skipLabelOf` names the edges whose label is already reported as not fitting the gap between its
// two elements (hiddenLabels), so the same label is not reported twice.
export function edgeIssues(diagram: DiagramFile, skipLabelOf: ReadonlySet<string>): EdgeIssue[] {
  const nodes = layoutNodes(diagram)
  const family = diagram.fontFamily ?? DEFAULT_FONT_FAMILY
  const name = (n: LaidOutNode): string => shortName(n.node.data.label || n.node.id)
  const parentOf = (n: LaidOutNode): LaidOutNode | undefined => nodes.get(n.node.parentId ?? '')
  const isInside = (n: LaidOutNode, ancestorId: string): boolean => {
    for (let p = parentOf(n), hops = 0; p && hops < 200; p = parentOf(p), hops += 1) {
      if (p.node.id === ancestorId) return true
    }
    return false
  }
  const solid = [...nodes.values()].filter((n) => n.kind === 'entity' || n.kind === 'text')
  const rectOf = (n: LaidOutNode): Rect => ({ x: n.x, y: n.y, width: n.width, height: n.height })

  const drawn: DrawnEdge[] = []
  for (const laid of layoutEdges(orientEdges(diagram), nodes)) {
    const { edge, from, to } = laid
    const d = buildEdgePath(edge.style?.routingStyle, from, to, edge.points ?? [], LEAD_IN_PX)
    const path = flattenPath(d)
    if (path.length < 2) continue
    const entry: DrawnEdge = { laid, id: edge.id, path, box: boxOf(path) }
    if (edge.label && edge.label.trim() !== '' && !skipLabelOf.has(edge.id)) {
      const font = resolveEdgeLabelLook(edge.style, 'light', family).font
      const size = labelChipSize(edge.label, font)
      const at = pointAtRatio(d, edge.style?.labelPosition ?? 0.5)
      entry.chip = { x: at.x - size.width / 2, y: at.y - size.height / 2, ...size }
    }
    drawn.push(entry)
  }

  // The box the export draws a container's title in: inside the wall, from its top left.
  const containers = [...nodes.values()].filter((n) => n.kind === 'container')
  const titleOf = (c: LaidOutNode): Rect | undefined => {
    const text = c.node.data.label ?? ''
    if (text.trim() === '') return undefined
    const look = resolveLabelLook('container', c.node.style, 'light', family)
    const wall = resolveBoxLook('container', c.node.style, 'light', undefined).strokeWidth
    const lines = wrapText(text, Math.max(0, c.width - wall * 2 - 8), look.font)
    const width = Math.max(...lines.map((line) => measureText(line, look.font)))
    return {
      x: c.x + wall + 8,
      y: c.y + wall + 4,
      width,
      height: lines.length * look.font.size * LINE_HEIGHT_EM
    }
  }

  const nameOfEdge = (e: DrawnEdge): string => {
    const from = nodes.get(e.laid.edge.source)
    const to = nodes.get(e.laid.edge.target)
    return `edge ${e.id} (${from ? name(from) : e.laid.edge.source} to ${to ? name(to) : e.laid.edge.target})`
  }
  const issues: EdgeIssue[] = []

  for (const e of drawn) {
    const { source, target } = e.laid.edge
    for (const other of solid) {
      if (other.node.id === source || other.node.id === target) continue
      if (isInside(other, source) || isInside(other, target)) continue
      const room = shrink(rectOf(other), EDGE_INSET_PX)
      if (boxesTouch(e.box, room) && pathHits(e.path, room)) {
        issues.push({
          kind: 'edge-through-element',
          message: `${nameOfEdge(e)} is drawn across "${name(other)}" (${other.node.id})`,
          ids: [e.id, other.node.id]
        })
      }
    }
  }

  for (let i = 0; i < drawn.length; i += 1) {
    for (let j = i + 1; j < drawn.length; j += 1) {
      if (!boxesTouch(drawn[i].box, drawn[j].box)) continue
      if (firstCrossing(drawn[i], drawn[j])) {
        issues.push({
          kind: 'edge-crossing',
          message: `${nameOfEdge(drawn[i])} and ${nameOfEdge(drawn[j])} cross`,
          ids: [drawn[i].id, drawn[j].id]
        })
      }
    }
  }

  for (const e of drawn) {
    const chip = e.chip
    if (!chip) continue
    const label = `the label of ${nameOfEdge(e)}`
    for (const other of solid) {
      const { x, y } = overlapOf(chip, rectOf(other))
      if (x > OVERLAP_PX && y > OVERLAP_PX) {
        issues.push({
          kind: 'label-over-element',
          message: `${label} covers "${name(other)}" (${other.node.id}): move the element, the label along the edge, or the edge`,
          ids: [e.id, other.node.id]
        })
      }
    }
    for (const container of containers) {
      const wall = rectOf(container)
      const title = titleOf(container)
      const onTitle = title ? overlapOf(chip, title) : { x: 0, y: 0 }
      if (onTitle.x > OVERLAP_PX && onTitle.y > OVERLAP_PX) {
        issues.push({
          kind: 'label-over-container-title',
          message: `${label} covers the title of "${name(container)}" (${container.node.id}): move the label along its edge`,
          ids: [e.id, container.node.id]
        })
      }
      const within = overlapOf(chip, wall)
      if (within.x <= OVERLAP_PX || within.y <= OVERLAP_PX) continue
      const inner = shrink(wall, WALL_BAND_PX)
      const fullyInside =
        chip.x >= inner.x &&
        chip.y >= inner.y &&
        chip.x + chip.width <= inner.x + inner.width &&
        chip.y + chip.height <= inner.y + inner.height
      if (!fullyInside) {
        issues.push({
          kind: 'label-on-container-border',
          message: `${label} sits on the border of "${name(container)}" (${container.node.id}): move the label along its edge so it lies wholly inside or outside, or leave more room`,
          ids: [e.id, container.node.id]
        })
      }
    }
    for (const other of drawn) {
      if (other === e) continue
      if (other.chip && other.id > e.id) {
        const { x, y } = overlapOf(chip, other.chip)
        if (x > OVERLAP_PX && y > OVERLAP_PX) {
          issues.push({
            kind: 'label-over-label',
            message: `${label} overlaps the label of ${nameOfEdge(other)}: move one label along its edge or space the elements out`,
            ids: [e.id, other.id]
          })
        }
      }
      if (boxesTouch(other.box, chip) && pathHits(other.path, shrink(chip, 1))) {
        issues.push({
          kind: 'label-over-edge',
          message: `${label} sits on ${nameOfEdge(other)}: move the label along its edge or reroute one of them`,
          ids: [e.id, other.id]
        })
      }
    }
  }
  return issues
}
