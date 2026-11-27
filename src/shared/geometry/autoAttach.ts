// Automatic attachment: an edge end that names no connection point is attached by the renderer, and this
// is the rule. The end takes the side of its element that faces the other element and a
// point on that side: points other edges do not use first, in the order of where the other ends are, so
// the edges do not cross at the element. It is worked out from where the elements are, every time, so
// it follows them as they move; nothing is stored. Pure: the canvas, the exports and the layout checks
// all ask this.
import type { ConnectionPoint, ConnectionPointSide } from '../diagram'
import { effectivePointsForSide } from './connectionPoints.ts'

// Edges leave by the left and right sides ('x') or by the top and bottom ('y').
export type AutoAxis = 'x' | 'y'

// How much clearer one axis must be than the other before an edge changes from one to the other, so an
// edge between elements that are nearly diagonal to each other does not flip while one is dragged.
export const AXIS_MARGIN = 24

export interface AttachNode {
  id: string
  x: number
  y: number
  width: number
  height: number
  points: ConnectionPoint[]
}

export interface AttachEdge {
  id: string
  source: string
  target: string
  sourceHandle?: string | null
  targetHandle?: string | null
}

export interface AutoEnds {
  sourceHandle?: string
  targetHandle?: string
}

interface End {
  edgeId: string
  end: 'source' | 'target'
  nodeId: string
  side: ConnectionPointSide
  // Where the other element is along this side.
  key: number
}

const alongX = (side: ConnectionPointSide): boolean => side === 'top' || side === 'bottom'

// The handle each automatic end resolves to, for the edges that have one; an end that is not listed keeps
// the old fallback (the element's first point), as does an end between elements that overlap.
// `memory` remembers each edge's axis between calls, for the margin above; it is updated as it goes.
export function automaticHandles(
  nodes: Iterable<AttachNode>,
  edges: Iterable<AttachEdge>,
  memory?: Map<string, AutoAxis>
): Map<string, AutoEnds> {
  const result = new Map<string, AutoEnds>()
  const list = [...edges]
  if (!list.some((e) => !e.sourceHandle || !e.targetHandle)) return result
  const byId = new Map<string, AttachNode>()
  for (const node of nodes) byId.set(node.id, node)

  // Which points of each element edges already name.
  const used = new Map<string, Set<string>>()
  const note = (nodeId: string, handle: string | null | undefined): void => {
    if (!handle) return
    const set = used.get(nodeId) ?? new Set<string>()
    set.add(handle)
    used.set(nodeId, set)
  }
  for (const e of list) {
    note(e.source, e.sourceHandle)
    note(e.target, e.targetHandle)
  }

  const groups = new Map<string, End[]>()
  for (const e of list) {
    if (e.sourceHandle && e.targetHandle) continue
    const a = byId.get(e.source)
    const b = byId.get(e.target)
    if (!a || !b || a === b) continue
    const gapX = Math.max(b.x - (a.x + a.width), a.x - (b.x + b.width))
    const gapY = Math.max(b.y - (a.y + a.height), a.y - (b.y + b.height))
    if (gapX <= 0 && gapY <= 0) continue
    let axis: AutoAxis
    if (gapX > 0 && gapY <= 0) axis = 'x'
    else if (gapY > 0 && gapX <= 0) axis = 'y'
    else if (gapX > gapY + AXIS_MARGIN) axis = 'x'
    else if (gapY > gapX + AXIS_MARGIN) axis = 'y'
    else axis = memory?.get(e.id) ?? (gapX >= gapY ? 'x' : 'y')
    memory?.set(e.id, axis)
    const forward =
      axis === 'x'
        ? a.x + a.width / 2 <= b.x + b.width / 2
        : a.y + a.height / 2 <= b.y + b.height / 2
    const sides: [ConnectionPointSide, ConnectionPointSide] =
      axis === 'x'
        ? forward
          ? ['right', 'left']
          : ['left', 'right']
        : forward
          ? ['bottom', 'top']
          : ['top', 'bottom']
    for (const [end, node, other, side, handle] of [
      ['source', a, b, sides[0], e.sourceHandle],
      ['target', b, a, sides[1], e.targetHandle]
    ] as const) {
      if (handle) continue
      const key = alongX(side) ? other.x + other.width / 2 : other.y + other.height / 2
      const slot = `${node.id}\u0001${side}`
      const group = groups.get(slot) ?? []
      group.push({ edgeId: e.id, end, nodeId: node.id, side, key })
      groups.set(slot, group)
    }
  }

  for (const ends of groups.values()) {
    const { nodeId, side } = ends[0]
    const node = byId.get(nodeId) as AttachNode
    const all = effectivePointsForSide(node.points, side)
      .slice()
      .sort((p, q) => p.offset - q.offset)
    // Points nobody names first; with none left, all of them, shared.
    const free = all.filter((p) => !used.get(nodeId)?.has(p.id))
    const choices = free.length > 0 ? free : all
    const start = alongX(side) ? node.x : node.y
    const length = alongX(side) ? node.width : node.height
    const place = (p: ConnectionPoint): number => start + p.offset * length
    ends.sort((p, q) => p.key - q.key || p.edgeId.localeCompare(q.edgeId))
    const picked: ConnectionPoint[] = []
    if (ends.length <= choices.length) {
      // In order, each on the point nearest to where its other end is, leaving room for the rest.
      let from = 0
      ends.forEach((end, i) => {
        const wanted = Math.min(Math.max(end.key, start), start + length)
        const last = choices.length - (ends.length - i)
        let best = from
        for (let j = from; j <= last; j += 1) {
          if (Math.abs(place(choices[j]) - wanted) < Math.abs(place(choices[best]) - wanted)) {
            best = j
          }
        }
        picked.push(choices[best])
        from = best + 1
      })
    } else {
      ends.forEach((_, i) => picked.push(choices[Math.floor((i * choices.length) / ends.length)]))
    }
    ends.forEach((end, i) => {
      const entry = result.get(end.edgeId) ?? {}
      if (end.end === 'source') entry.sourceHandle = picked[i].id
      else entry.targetHandle = picked[i].id
      result.set(end.edgeId, entry)
    })
  }
  return result
}
