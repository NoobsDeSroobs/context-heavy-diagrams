// Springy connection points, one spring per point. The stored points of a side stay evenly spaced;
// when two edges' ends are a little out of line, each point slides along its side from its own slot so
// the edge runs straight, and past the range the edge bends instead. A point is tied only to its own
// slot, so what happens to a point does not move the others (unless they would meet). Pure: the canvas
// draws the handles where this says, and the exports and the layout checks use the same places.
import type { ConnectionPoint, ConnectionPointSide } from '../diagram'
import { effectiveConnectionPoints } from './connectionPoints.ts'

// How far a point may slide off its slot, and the least room two neighbouring points keep.
export const SLIDE_RANGE = 10
const MIN_GAP = 6
const SIDE_MARGIN = 4

export interface SlideNode {
  id: string
  x: number
  y: number
  width: number
  height: number
  points: ConnectionPoint[]
}

export interface SlideEdge {
  source: string
  target: string
  sourceHandle?: string | null
  targetHandle?: string | null
  // An edge with bend points of its own is left as the person drew it.
  bent?: boolean
}

export const slideKey = (nodeId: string, pointId: string): string => `${nodeId}:${pointId}`

const OPPOSITE: Partial<Record<ConnectionPointSide, ConnectionPointSide>> = {
  top: 'bottom',
  bottom: 'top',
  left: 'right',
  right: 'left'
}
const alongX = (side: ConnectionPointSide): boolean => side === 'top' || side === 'bottom'

// How far each point slides along its side, in pixels (positive: right or down); points that stay in
// their slot are left out. Keys are `slideKey(nodeId, pointId)`.
export function pointSlides(
  nodes: Iterable<SlideNode>,
  edges: Iterable<SlideEdge>
): Map<string, number> {
  const byId = new Map<string, SlideNode>()
  const pointsOf = new Map<string, ConnectionPoint[]>()
  for (const node of nodes) {
    byId.set(node.id, node)
    pointsOf.set(node.id, effectiveConnectionPoints(node.points))
  }
  const place = (node: SlideNode, point: ConnectionPoint): { along: number; length: number } =>
    alongX(point.side)
      ? { along: node.x + point.offset * node.width, length: node.width }
      : { along: node.y + point.offset * node.height, length: node.height }

  // What each point is asked to do: the wishes of its edges, averaged.
  const wishes = new Map<string, { sum: number; count: number }>()
  const wish = (key: string, shift: number): void => {
    const entry = wishes.get(key) ?? { sum: 0, count: 0 }
    entry.sum += shift
    entry.count += 1
    wishes.set(key, entry)
  }
  for (const edge of edges) {
    if (edge.bent || !edge.sourceHandle || !edge.targetHandle) continue
    const from = byId.get(edge.source)
    const to = byId.get(edge.target)
    if (!from || !to) continue
    const a = pointsOf.get(from.id)?.find((p) => p.id === edge.sourceHandle)
    const b = pointsOf.get(to.id)?.find((p) => p.id === edge.targetHandle)
    if (!a || !b || OPPOSITE[a.side] !== b.side) continue
    const miss = place(to, b).along - place(from, a).along
    // Out of reach for both ends together: the edge bends, and nothing pulls.
    if (Math.abs(miss) > 2 * SLIDE_RANGE) continue
    wish(slideKey(from.id, a.id), miss / 2)
    wish(slideKey(to.id, b.id), -miss / 2)
  }
  if (wishes.size === 0) return new Map()

  const slides = new Map<string, number>()
  const sides: ConnectionPointSide[] = ['top', 'right', 'bottom', 'left']
  for (const node of byId.values()) {
    const all = pointsOf.get(node.id) ?? []
    for (const side of sides) {
      const onSide = all.filter((p) => p.side === side).sort((p, q) => p.offset - q.offset)
      if (!onSide.some((p) => wishes.has(slideKey(node.id, p.id)))) continue
      const targets = onSide.map((p) => {
        const entry = wishes.get(slideKey(node.id, p.id))
        return entry ? entry.sum / entry.count : null
      })
      const length = place(node, onSide[0]).length
      const slots = onSide.map((p) => p.offset * length)
      const shifts = targets.map((wishedShift) =>
        Math.max(-SLIDE_RANGE, Math.min(SLIDE_RANGE, wishedShift ?? 0))
      )
      // Keep the order and some room between neighbours, and stay off the corners.
      for (let i = 0; i < onSide.length; i += 1) {
        const least = i === 0 ? SIDE_MARGIN : slots[i - 1] + shifts[i - 1] + MIN_GAP
        shifts[i] = Math.max(shifts[i], least - slots[i])
      }
      for (let i = onSide.length - 1; i >= 0; i -= 1) {
        const most =
          i === onSide.length - 1 ? length - SIDE_MARGIN : slots[i + 1] + shifts[i + 1] - MIN_GAP
        shifts[i] = Math.min(shifts[i], most - slots[i])
      }
      onSide.forEach((p, i) => {
        const shift = Math.round(shifts[i] * 100) / 100
        if (Math.abs(shift) >= 0.01) slides.set(slideKey(node.id, p.id), shift)
      })
    }
  }
  return slides
}
