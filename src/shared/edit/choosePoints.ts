// Choosing the connection points of the edges `route_edges` routes (ADR 0177). Pure: a diagram in, a
// copy out with each of those edges on a point of its own, on the side facing its other end. Nothing is
// placed by hand: a side's points stay evenly spaced, as the app spaces them (ADR 0175), and the edges
// take them in the order of where their other ends are, so they do not cross at the element.
import type {
  ConnectionPoint,
  ConnectionPointSide,
  DiagramFile,
  DiagramNode
} from '../diagram/index.ts'
import { layoutNodes, type LaidOutNode } from '../export/model.ts'
import {
  effectiveConnectionPoints,
  effectivePointsForSide,
  evenOffsets,
  pointCoordinates
} from '../geometry/connectionPoints.ts'

export interface PointPlan {
  // A copy of the diagram with the chosen points and handles.
  diagram: DiagramFile
  // The edges now on other connection points.
  moved: Set<string>
  // Edges that were not chosen but have bend points of their own and an end that moved with its side:
  // their route no longer fits and is drawn again.
  affected: Set<string>
  notices: string[]
}

const SIDES: ConnectionPointSide[] = ['top', 'right', 'bottom', 'left']
const SEP = ''

interface End {
  edgeId: string
  end: 'source' | 'target'
  // Where the other end is along this side, to put the ends in order.
  key: number
}

// One point of a side in the new order: an existing point other edges use, or one for chosen ends.
interface Slot {
  id?: string
  fixed: boolean
  ends: End[]
  sum: number
  count: number
}

const keyOf = (slot: Slot): number => slot.sum / Math.max(slot.count, 1)

// The sides two boxes face each other by: across the wider gap, towards where the other one is.
// Undefined where they overlap on both axes.
function facing(
  a: LaidOutNode,
  b: LaidOutNode
): [ConnectionPointSide, ConnectionPointSide] | undefined {
  const gapX = Math.max(b.x - (a.x + a.width), a.x - (b.x + b.width))
  const gapY = Math.max(b.y - (a.y + a.height), a.y - (b.y + b.height))
  if (gapX <= 0 && gapY <= 0) return undefined
  if (gapX >= gapY)
    return a.x + a.width / 2 <= b.x + b.width / 2 ? ['right', 'left'] : ['left', 'right']
  return a.y + a.height / 2 <= b.y + b.height / 2 ? ['bottom', 'top'] : ['top', 'bottom']
}

const centreAlong = (n: LaidOutNode, side: ConnectionPointSide): number =>
  side === 'top' || side === 'bottom' ? n.x + n.width / 2 : n.y + n.height / 2

// The point an edge uses on a node, the way the layout resolves it: the named one, or the first.
function pointOf(node: DiagramNode, handle: string | undefined): ConnectionPoint | undefined {
  const points = effectiveConnectionPoints(node.connectionPoints ?? [])
  return points.length === 1 || !handle ? points[0] : points.find((p) => p.id === handle)
}

export function choosePoints(
  diagram: DiagramFile,
  chosen: ReadonlySet<string>,
  limit: number
): PointPlan {
  const copy = JSON.parse(JSON.stringify(diagram)) as DiagramFile
  const nodes = layoutNodes(copy)
  const plan: PointPlan = { diagram: copy, moved: new Set(), affected: new Set(), notices: [] }
  const edgeById = new Map(copy.edges.map((e) => [e.id, e]))
  const before = new Map<string, { x: number; y: number } | undefined>()
  const place = (
    nodeId: string,
    handle: string | undefined
  ): { x: number; y: number } | undefined => {
    const laid = nodes.get(nodeId)
    const point = laid && pointOf(laid.node, handle)
    return laid && point
      ? pointCoordinates(
          { left: laid.x, top: laid.y, width: laid.width, height: laid.height },
          point
        )
      : undefined
  }
  for (const e of copy.edges) {
    before.set(`${e.id}:source`, place(e.source, e.sourceHandle))
    before.set(`${e.id}:target`, place(e.target, e.targetHandle))
  }

  // Each chosen edge's two ends: the side facing the other element (its own, where they overlap).
  const wanted = new Map<string, End[]>()
  const touched = new Set<string>()
  const sideKey = (nodeId: string, side: ConnectionPointSide): string => `${nodeId}${SEP}${side}`
  const decided = new Set<string>()
  for (const id of chosen) {
    const edge = edgeById.get(id)
    if (!edge) continue
    const a = nodes.get(edge.source)
    const b = nodes.get(edge.target)
    if (!a || !b || a.kind !== 'entity' || b.kind !== 'entity') continue
    const now = {
      source: pointOf(a.node, edge.sourceHandle)?.side,
      target: pointOf(b.node, edge.targetHandle)?.side
    }
    const sides = facing(a, b) ?? (now.source && now.target ? [now.source, now.target] : undefined)
    if (!sides) continue
    decided.add(id)
    for (const [end, node, other] of [
      ['source', a, b],
      ['target', b, a]
    ] as const) {
      const side = sides[end === 'source' ? 0 : 1]
      const list = wanted.get(sideKey(node.node.id, side)) ?? []
      list.push({ edgeId: id, end, key: centreAlong(other, side) })
      wanted.set(sideKey(node.node.id, side), list)
      touched.add(sideKey(node.node.id, side))
      const old = now[end]
      if (old) touched.add(sideKey(node.node.id, old))
    }
  }

  // The edges that stay as they are, and which of a node's points they use.
  const users = new Map<string, Map<string, number[]>>()
  // Nodes with an edge that names no point, which uses the first one stored.
  const nameless = new Set<string>()
  for (const edge of copy.edges) {
    if (decided.has(edge.id)) continue
    for (const [nodeId, otherId, handle] of [
      [edge.source, edge.target, edge.sourceHandle],
      [edge.target, edge.source, edge.targetHandle]
    ] as const) {
      const node = nodes.get(nodeId)
      const other = nodes.get(otherId)
      if (!node || !other) continue
      const point = pointOf(node.node, handle)
      if (!point) continue
      if (!handle) nameless.add(nodeId)
      const perNode = users.get(nodeId) ?? new Map<string, number[]>()
      const list = perNode.get(point.id) ?? []
      list.push(centreAlong(other, point.side))
      perNode.set(point.id, list)
      users.set(nodeId, perNode)
    }
  }

  for (const key of [...touched].sort()) {
    const [nodeId, sideName] = key.split(SEP) as [string, ConnectionPointSide]
    const laid = nodes.get(nodeId) as LaidOutNode
    const node = laid.node
    const stored = node.connectionPoints ?? []
    const current = effectivePointsForSide(stored, sideName)
      .slice()
      .sort((p, q) => p.offset - q.offset)
    const used = users.get(nodeId) ?? new Map<string, number[]>()

    const fixed: Slot[] = current
      .filter((p) => used.has(p.id))
      .map((p) => {
        const keys = used.get(p.id) as number[]
        return {
          id: p.id,
          fixed: true,
          ends: [],
          sum: keys.reduce((s, k) => s + k, 0),
          count: keys.length
        }
      })
    const pool = current.filter((p) => !used.has(p.id)).map((p) => p.id)
    const ends = (wanted.get(key) ?? []).sort(
      (p, q) => p.key - q.key || p.edgeId.localeCompare(q.edgeId) || (p.end < q.end ? -1 : 1)
    )

    // Chosen ends go among the points that stay, by where their other ends are.
    const slots: Slot[] = []
    let next = 0
    for (const end of ends) {
      while (next < fixed.length && keyOf(fixed[next]) <= end.key) slots.push(fixed[next++])
      slots.push({ fixed: false, ends: [end], sum: end.key, count: 1 })
    }
    while (next < fixed.length) slots.push(fixed[next++])

    // More edges than a side may hold: the closest chosen ones share a point.
    let shared = false
    while (slots.length > limit) {
      let at = -1
      let gap = Infinity
      slots.forEach((slot, i) => {
        if (slot.fixed) return
        for (const j of [i - 1, i + 1]) {
          if (j < 0 || j >= slots.length) continue
          const d = Math.abs(keyOf(slot) - keyOf(slots[j]))
          if (d < gap) {
            gap = d
            at = i
          }
        }
      })
      if (at < 0) break
      const into = at > 0 ? at - 1 : at + 1
      const [folded] = slots.splice(at, 1)
      const host = slots[into > at ? into - 1 : into]
      host.ends.push(...folded.ends)
      host.sum += folded.sum
      host.count += folded.count
      shared = true
    }
    if (shared) {
      plan.notices.push(
        `${node.id}: its ${sideName} side holds ${limit} points, so some edges share one`
      )
    }

    // Ids: the points that stay keep theirs; the others reuse ones the side no longer needs, else a new one.
    const taken = new Set([...stored.map((p) => p.id), ...SIDES])
    const fresh = (): string => {
      let n = 1
      while (taken.has(`cp-${n}`)) n += 1
      taken.add(`cp-${n}`)
      return `cp-${n}`
    }
    const offsets = evenOffsets(slots.length)
    const written: ConnectionPoint[] = slots.map((slot, i) => {
      if (!slot.id) slot.id = pool.shift() ?? fresh()
      for (const end of slot.ends) {
        const edge = edgeById.get(end.edgeId) as (typeof copy.edges)[number]
        if (end.end === 'source') edge.sourceHandle = slot.id
        else edge.targetHandle = slot.id
      }
      return { id: slot.id, side: sideName, offset: offsets[i] }
    })
    // One centred point named after its side is what a side with nothing stored has anyway.
    const plain = written.length === 1 && written[0].id === sideName && written[0].offset === 0.5
    // An edge naming no point uses the first one stored: keep that point first.
    const first = nameless.has(nodeId)
      ? pointOf(diagram.nodes.find((n) => n.id === nodeId) as DiagramNode, undefined)
      : undefined
    const ordered =
      first && first.side === sideName
        ? [...written.filter((p) => p.id === first.id), ...written.filter((p) => p.id !== first.id)]
        : written
    const others = stored.filter((p) => p.side !== sideName)
    const rest = plain || written.length === 0 ? others : [...others, ...ordered]
    if (rest.length > 0) node.connectionPoints = rest
    else delete node.connectionPoints
  }

  for (const id of chosen) {
    const edge = edgeById.get(id)
    if (!edge || !decided.has(id)) continue
    const was = diagram.edges.find((e) => e.id === id) as (typeof diagram.edges)[number]
    if (edge.sourceHandle !== was.sourceHandle || edge.targetHandle !== was.targetHandle) {
      plan.moved.add(id)
    }
  }
  // An edge with bend points of its own whose end sits somewhere else now.
  for (const edge of copy.edges) {
    if (chosen.has(edge.id) || (edge.points?.length ?? 0) === 0) continue
    for (const [end, nodeId, handle] of [
      ['source', edge.source, edge.sourceHandle],
      ['target', edge.target, edge.targetHandle]
    ] as const) {
      const was = before.get(`${edge.id}:${end}`)
      const now = place(nodeId, handle)
      if (was && now && (Math.abs(was.x - now.x) > 0.01 || Math.abs(was.y - now.y) > 0.01)) {
        plan.affected.add(edge.id)
      }
    }
  }
  return plan
}
