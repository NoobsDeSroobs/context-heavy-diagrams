// Routing edges around the elements they do not join, with right angles (ADR 0174). Pure: a diagram in,
// the bend points out. The assistant decides where everything goes; this only draws the edges.
//
// How: a grid of "lanes" is laid over the free space between the elements (the gaps between their
// sides, a few lanes in a wide gap, and a few around the whole drawing). An edge leaves its connection
// point straight out and is searched through the lanes, cheapest first: length, a price for each bend,
// for crossing another edge, for running along another edge's lane and for passing through a
// container it does not belong to. Edges are routed one after the other, shortest first, each seeing
// the ones before it.
import type { DiagramFile, LinePoint } from '../diagram/index.ts'
import { layoutEdges, layoutNodes, type LaidOutNode } from '../export/model.ts'
import { buildEdgePath, OUTWARD_DIRECTION } from '../geometry/edgePath.ts'
import { flattenPath, type Point } from '../geometry/pathSampling.ts'
import type { Side } from '../geometry/side.ts'
import { DEFAULT_PREFERENCES } from '../preferences/preferences.ts'
import { edgeIssues, segmentHits, type Rect } from './edgeRouting.ts'

// How far a lane keeps from an element, and the straight piece an edge leaves its element by.
const MIN_CLEAR = 9
const STUB = 14
// Lanes in a gap are this far apart, at most this many, and this many run round the whole drawing.
const LANE = 10
const MAX_LANES = 4
const OUTSIDE_LANES = 3
// What a route costs, in pixels of length.
const BEND_COST = 45
const CROSS_COST = 400
const SHARED_LANE_PER_PX = 12
const FOREIGN_CONTAINER_PER_PX = 2
// The routing as a whole gives up on the edges left after this long.
const MAX_MS = 8000
// How far an edge may reach into an element's border without counting as over it (as the check).
const INSET = 2

const DIRS = [
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
  { x: 0, y: -1 }
]
const DIR_OF_SIDE: Record<Side, number> = { right: 0, bottom: 1, left: 2, top: 3 }

export interface RouteResult {
  // The bend points of each edge that was routed, in order from its source end (empty: it runs straight).
  routed: Map<string, LinePoint[]>
  // The edges that could not be routed, with why.
  failed: Map<string, string>
}

interface Grid {
  xs: number[]
  ys: number[]
  nx: number
  ny: number
  free: Uint8Array
  // For each node, which of the containers hold it (an index into `sigs`).
  sig: Uint16Array
  sigs: number[][]
  // Per lane piece: how many other edges cross it, and how many run along it.
  hCross: Uint8Array
  hOver: Uint8Array
  vCross: Uint8Array
  vOver: Uint8Array
}

const sortedUnique = (values: number[]): number[] =>
  [...new Set(values.map((v) => Math.round(v * 100) / 100))].sort((a, b) => a - b)

// The lines of the grid on one axis: the sides of the elements, lanes in the gaps between them, and
// lanes outside them all.
function laneLines(sides: number[], extra: number[]): number[] {
  const base = sortedUnique(sides)
  const lines = new Set<number>(base)
  for (let i = 0; i + 1 < base.length; i += 1) {
    const gap = base[i + 1] - base[i]
    if (gap < 2 * MIN_CLEAR) continue
    const count = Math.min(MAX_LANES, Math.floor((gap - 2 * MIN_CLEAR) / LANE) + 1)
    const middle = (base[i] + base[i + 1]) / 2
    for (let k = 0; k < count; k += 1) lines.add(middle + (k - (count - 1) / 2) * LANE)
  }
  if (base.length > 0) {
    for (let k = 0; k < OUTSIDE_LANES; k += 1) {
      lines.add(base[0] - MIN_CLEAR - 4 - k * LANE)
      lines.add(base[base.length - 1] + MIN_CLEAR + 4 + k * LANE)
    }
  }
  for (const value of extra) lines.add(value)
  return sortedUnique([...lines])
}

// The index of the last line at or before `value`.
function lastAtOrBefore(lines: number[], value: number): number {
  let low = 0
  let high = lines.length - 1
  let found = -1
  while (low <= high) {
    const mid = (low + high) >> 1
    if (lines[mid] <= value) {
      found = mid
      low = mid + 1
    } else high = mid - 1
  }
  return found
}

const indexOfLine = (lines: number[], value: number): number => {
  const at = lastAtOrBefore(lines, value + 0.01)
  return at >= 0 && Math.abs(lines[at] - value) < 0.5 ? at : -1
}

// Records a drawn polyline on the grid: the lane pieces it crosses, and the ones it runs along.
function ingest(grid: Grid, path: Point[]): void {
  const { xs, ys, nx } = grid
  for (let k = 1; k < path.length; k += 1) {
    const p = path[k - 1]
    const q = path[k]
    const dx = q.x - p.x
    const dy = q.y - p.y
    // Vertical lanes this piece crosses.
    if (Math.abs(dx) > 0.01) {
      const [lo, hi] = p.x < q.x ? [p.x, q.x] : [q.x, p.x]
      for (let i = lastAtOrBefore(xs, lo) + 1; i < xs.length && xs[i] < hi; i += 1) {
        if (xs[i] <= lo) continue
        const y = p.y + ((xs[i] - p.x) / dx) * dy
        const j = lastAtOrBefore(grid.ys, y)
        if (j >= 0 && j < grid.ny - 1)
          grid.vCross[j * nx + i] = Math.min(255, grid.vCross[j * nx + i] + 1)
      }
    }
    // Horizontal lanes this piece crosses.
    if (Math.abs(dy) > 0.01) {
      const [lo, hi] = p.y < q.y ? [p.y, q.y] : [q.y, p.y]
      for (let j = lastAtOrBefore(ys, lo) + 1; j < ys.length && ys[j] < hi; j += 1) {
        if (ys[j] <= lo) continue
        const x = p.x + ((ys[j] - p.y) / dy) * dx
        const i = lastAtOrBefore(xs, x)
        if (i >= 0 && i < nx - 1) {
          const at = j * (nx - 1) + i
          grid.hCross[at] = Math.min(255, grid.hCross[at] + 1)
        }
      }
    }
    // Along a lane.
    if (Math.abs(dx) < 0.5 && Math.abs(dy) >= 0.5) {
      const i = indexOfLine(xs, p.x)
      if (i >= 0) {
        const [lo, hi] = p.y < q.y ? [p.y, q.y] : [q.y, p.y]
        for (let j = Math.max(0, lastAtOrBefore(ys, lo - 0.5)); j + 1 < ys.length; j += 1) {
          if (ys[j] < lo - 0.5) continue
          if (ys[j + 1] > hi + 0.5) break
          grid.vOver[j * nx + i] = Math.min(255, grid.vOver[j * nx + i] + 1)
        }
      }
    } else if (Math.abs(dy) < 0.5 && Math.abs(dx) >= 0.5) {
      const j = indexOfLine(ys, p.y)
      if (j >= 0) {
        const [lo, hi] = p.x < q.x ? [p.x, q.x] : [q.x, p.x]
        for (let i = Math.max(0, lastAtOrBefore(xs, lo - 0.5)); i + 1 < xs.length; i += 1) {
          if (xs[i] < lo - 0.5) continue
          if (xs[i + 1] > hi + 0.5) break
          grid.hOver[j * (nx - 1) + i] = Math.min(255, grid.hOver[j * (nx - 1) + i] + 1)
        }
      }
    }
  }
}

// Does the polyline cross a segment of any of these paths (not counting a meeting at an end)?
function crossesAny(path: Point[], others: Point[][]): boolean {
  const cross = (a: Point, b: Point, c: Point, d: Point): boolean => {
    const rx = b.x - a.x
    const ry = b.y - a.y
    const sx = d.x - c.x
    const sy = d.y - c.y
    const denominator = rx * sy - ry * sx
    if (denominator === 0) return false
    const t = ((c.x - a.x) * sy - (c.y - a.y) * sx) / denominator
    const u = ((c.x - a.x) * ry - (c.y - a.y) * rx) / denominator
    return t > 0.001 && t < 0.999 && u > 0.001 && u < 0.999
  }
  for (const other of others) {
    for (let i = 1; i < path.length; i += 1) {
      for (let j = 1; j < other.length; j += 1) {
        if (cross(path[i - 1], path[i], other[j - 1], other[j])) return true
      }
    }
  }
  return false
}

class Heap {
  private keys: number[] = []
  private items: number[] = []
  get size(): number {
    return this.keys.length
  }
  push(key: number, item: number): void {
    let i = this.keys.length
    this.keys.push(key)
    this.items.push(item)
    while (i > 0) {
      const parent = (i - 1) >> 1
      if (this.keys[parent] <= key) break
      this.keys[i] = this.keys[parent]
      this.items[i] = this.items[parent]
      i = parent
    }
    this.keys[i] = key
    this.items[i] = item
  }
  pop(): number {
    const top = this.items[0]
    const lastKey = this.keys.pop() as number
    const lastItem = this.items.pop() as number
    const n = this.keys.length
    if (n > 0) {
      let i = 0
      for (;;) {
        let child = 2 * i + 1
        if (child >= n) break
        if (child + 1 < n && this.keys[child + 1] < this.keys[child]) child += 1
        if (this.keys[child] >= lastKey) break
        this.keys[i] = this.keys[child]
        this.items[i] = this.items[child]
        i = child
      }
      this.keys[i] = lastKey
      this.items[i] = lastItem
    }
    return top
  }
}

const near = (a: number, b: number): boolean => Math.abs(a - b) < 0.5

// Drops the vertices that lie on a straight line between their neighbours.
function simplify(points: Point[]): Point[] {
  const out: Point[] = []
  for (const p of points) {
    const last = out[out.length - 1]
    if (last && near(last.x, p.x) && near(last.y, p.y)) continue
    out.push(p)
    while (out.length >= 3) {
      const [a, b, c] = out.slice(-3)
      if ((near(a.x, b.x) && near(b.x, c.x)) || (near(a.y, b.y) && near(b.y, c.y))) {
        out.splice(out.length - 2, 1)
      } else break
    }
  }
  return out
}

export function routeEdges(diagram: DiagramFile, ids?: readonly string[]): RouteResult {
  const started = Date.now()
  const nodes = layoutNodes(diagram)
  const laid = layoutEdges(diagram.edges, nodes)
  const byId = new Map(laid.map((l) => [l.edge.id, l]))
  const routed = new Map<string, LinePoint[]>()
  const failed = new Map<string, string>()

  // Which edges to route: the ones asked for, else the ones the check reports.
  let wanted: string[]
  if (ids) {
    wanted = [...ids]
  } else {
    const reported = new Set<string>()
    for (const issue of edgeIssues(diagram, new Set())) {
      if (issue.kind !== 'edge-through-element' && issue.kind !== 'edge-crossing') continue
      for (const id of issue.ids) if (byId.has(id)) reported.add(id)
    }
    wanted = [...reported]
  }
  const candidates = new Set<string>()
  for (const id of wanted) {
    const entry = byId.get(id)
    if (!entry) {
      failed.set(id, 'not an edge of this diagram')
      continue
    }
    const { source, target } = entry.edge
    const from = nodes.get(source) as LaidOutNode
    const to = nodes.get(target) as LaidOutNode
    if (source === target) failed.set(id, 'joins an element to itself')
    else if (from.kind === 'container' || to.kind === 'container') {
      failed.set(id, 'joins a container, which is not routed')
    } else candidates.add(id)
  }
  if (candidates.size === 0) return { routed, failed }

  const solid = [...nodes.values()].filter((n) => n.kind === 'entity' || n.kind === 'text')
  const containers = [...nodes.values()].filter((n) => n.kind === 'container')
  const rectOf = (n: LaidOutNode): Rect => ({ x: n.x, y: n.y, width: n.width, height: n.height })

  // The edges not being routed stay as they are drawn; they are what the new routes avoid.
  const foreign: Point[][] = []
  const drawn = (id: string): Point[] => {
    const entry = byId.get(id) as (typeof laid)[number]
    return flattenPath(
      buildEdgePath(
        entry.edge.style?.routingStyle,
        entry.from,
        entry.to,
        entry.edge.points ?? [],
        DEFAULT_PREFERENCES.edgeStraightSegmentLength
      )
    )
  }
  for (const entry of laid) if (!candidates.has(entry.edge.id)) foreign.push(drawn(entry.edge.id))

  // The grid.
  const sideX: number[] = []
  const sideY: number[] = []
  for (const n of solid) {
    sideX.push(n.x, n.x + n.width)
    sideY.push(n.y, n.y + n.height)
  }
  const extraX: number[] = []
  const extraY: number[] = []
  const stubOf = (end: { x: number; y: number; side: Side }): { x: number; y: number } => ({
    x: end.x + OUTWARD_DIRECTION[end.side].x * STUB,
    y: end.y + OUTWARD_DIRECTION[end.side].y * STUB
  })
  for (const id of candidates) {
    const entry = byId.get(id) as (typeof laid)[number]
    for (const end of [entry.from, entry.to]) {
      const stub = stubOf(end)
      extraX.push(end.x, stub.x)
      extraY.push(end.y, stub.y)
    }
  }
  const xs = laneLines(sideX, extraX)
  const ys = laneLines(sideY, extraY)
  const nx = xs.length
  const ny = ys.length
  const grid: Grid = {
    xs,
    ys,
    nx,
    ny,
    free: new Uint8Array(nx * ny),
    sig: new Uint16Array(nx * ny),
    sigs: [[]],
    hCross: new Uint8Array(ny * (nx - 1)),
    hOver: new Uint8Array(ny * (nx - 1)),
    vCross: new Uint8Array((ny - 1) * nx),
    vOver: new Uint8Array((ny - 1) * nx)
  }
  const sigIndex = new Map<string, number>([['', 0]])
  for (let j = 0; j < ny; j += 1) {
    for (let i = 0; i < nx; i += 1) {
      const x = xs[i]
      const y = ys[j]
      let blocked = false
      for (const n of solid) {
        if (
          x > n.x - MIN_CLEAR &&
          x < n.x + n.width + MIN_CLEAR &&
          y > n.y - MIN_CLEAR &&
          y < n.y + n.height + MIN_CLEAR
        ) {
          blocked = true
          break
        }
      }
      grid.free[j * nx + i] = blocked ? 0 : 1
      const inside: number[] = []
      containers.forEach((c, index) => {
        if (x > c.x && x < c.x + c.width && y > c.y && y < c.y + c.height) inside.push(index)
      })
      if (inside.length > 0) {
        const key = inside.join(',')
        let at = sigIndex.get(key)
        if (at === undefined) {
          at = grid.sigs.length
          grid.sigs.push(inside)
          sigIndex.set(key, at)
        }
        grid.sig[j * nx + i] = at
      }
    }
  }
  for (const path of foreign) ingest(grid, path)

  const containerIndex = new Map(containers.map((c, index) => [c.node.id, index]))
  const ancestorsOf = (id: string): Set<number> => {
    const out = new Set<number>()
    const seen = new Set<string>()
    for (
      let at = nodes.get(id)?.node.parentId;
      at !== undefined && !seen.has(at);
      at = nodes.get(at)?.node.parentId
    ) {
      seen.add(at)
      const index = containerIndex.get(at)
      if (index !== undefined) out.add(index)
    }
    return out
  }

  // Shortest first: the short ones take their direct way, the long ones go round.
  const order = [...candidates].sort((a, b) => {
    const length = (id: string): number => {
      const e = byId.get(id) as (typeof laid)[number]
      return Math.abs(e.from.x - e.to.x) + Math.abs(e.from.y - e.to.y)
    }
    return length(a) - length(b)
  })

  const states = nx * ny * 4
  const best = new Float64Array(states)
  const previous = new Int32Array(states)

  const search = (id: string): Point[] | string => {
    const entry = byId.get(id) as (typeof laid)[number]
    const { from, to } = entry
    const stubS = stubOf(from)
    const stubT = stubOf(to)
    const si = indexOfLine(xs, stubS.x)
    const sj = indexOfLine(ys, stubS.y)
    const ti = indexOfLine(xs, stubT.x)
    const tj = indexOfLine(ys, stubT.y)
    if (si < 0 || sj < 0 || ti < 0 || tj < 0) return 'its ends are not on the grid'
    const start = sj * nx + si
    const goal = tj * nx + ti
    if (!grid.free[start] || !grid.free[goal]) return 'no room beside one of its ends'
    const allowed = new Set([...ancestorsOf(entry.edge.source), ...ancestorsOf(entry.edge.target)])
    const foreignCount = grid.sigs.map((list) => list.filter((c) => !allowed.has(c)).length)
    const startDir = DIR_OF_SIDE[from.side]
    const inward = (DIR_OF_SIDE[to.side] + 2) % 4

    best.fill(Infinity)
    const heap = new Heap()
    const first = start * 4 + startDir
    best[first] = 0
    previous[first] = -1
    const heuristic = (node: number): number =>
      Math.abs(xs[node % nx] - xs[goal % nx]) + Math.abs(ys[(node / nx) | 0] - ys[(goal / nx) | 0])
    heap.push(heuristic(start), first)
    let end = -1
    while (heap.size > 0) {
      const state = heap.pop()
      const node = state >> 2
      const dir = state & 3
      if (node === goal && dir === inward) {
        end = state
        break
      }
      const cost = best[state]
      // Arriving: turn to face the element, if not already.
      if (node === goal && dir !== (inward + 2) % 4) {
        const turned = node * 4 + inward
        const total = cost + BEND_COST
        if (total < best[turned]) {
          best[turned] = total
          previous[turned] = state
          heap.push(total, turned)
        }
      }
      for (const turn of [0, 1, 3]) {
        const nd = (dir + turn) & 3
        const i = node % nx
        const j = (node / nx) | 0
        const ni = i + DIRS[nd].x
        const nj = j + DIRS[nd].y
        if (ni < 0 || nj < 0 || ni >= nx || nj >= ny) continue
        const next = nj * nx + ni
        if (!grid.free[next]) continue
        const horizontal = nd === 0 || nd === 2
        const length = horizontal ? Math.abs(xs[ni] - xs[i]) : Math.abs(ys[nj] - ys[j])
        // The lane piece between the two nodes.
        const piece = horizontal ? nj * (nx - 1) + Math.min(i, ni) : Math.min(j, nj) * nx + i
        const crossed = horizontal ? grid.hCross[piece] : grid.vCross[piece]
        const shared = horizontal ? grid.hOver[piece] : grid.vOver[piece]
        const price =
          length * (1 + FOREIGN_CONTAINER_PER_PX * foreignCount[grid.sig[next]]) +
          length * SHARED_LANE_PER_PX * shared +
          CROSS_COST * crossed +
          (turn === 0 ? 0 : BEND_COST)
        const total = cost + price
        const ns = next * 4 + nd
        if (total < best[ns]) {
          best[ns] = total
          previous[ns] = state
          heap.push(total + heuristic(next), ns)
        }
      }
    }
    if (end < 0) return 'no route through the free space'

    const nodesOnPath: Point[] = []
    for (let s = end; s >= 0; s = previous[s]) {
      const node = s >> 2
      nodesOnPath.push({ x: xs[node % nx], y: ys[(node / nx) | 0] })
    }
    nodesOnPath.reverse()
    const polyline = simplify([{ x: from.x, y: from.y }, ...nodesOnPath, { x: to.x, y: to.y }])
    return polyline
  }

  const clearOfElements = (id: string, points: LinePoint[]): boolean => {
    const entry = byId.get(id) as (typeof laid)[number]
    const path = flattenPath(
      buildEdgePath(
        'step',
        entry.from,
        entry.to,
        points,
        DEFAULT_PREFERENCES.edgeStraightSegmentLength
      )
    )
    for (const n of solid) {
      // Its own two elements count too: a route may leave them, not run through them.
      const r = rectOf(n)
      const room: Rect = {
        x: r.x + INSET,
        y: r.y + INSET,
        width: Math.max(r.width - 2 * INSET, 0),
        height: Math.max(r.height - 2 * INSET, 0)
      }
      for (let k = 1; k < path.length; k += 1)
        if (segmentHits(path[k - 1], path[k], room)) return false
    }
    return true
  }

  for (const id of order) {
    if (Date.now() - started > MAX_MS) {
      failed.set(id, 'the time limit was reached')
      continue
    }
    const entry = byId.get(id) as (typeof laid)[number]
    // The edge's own way out, as the "step" style draws it with no bend points, when that is clean.
    const plain = flattenPath(
      buildEdgePath('step', entry.from, entry.to, [], DEFAULT_PREFERENCES.edgeStraightSegmentLength)
    )
    let points: LinePoint[] | undefined
    let path: Point[] | undefined
    if (clearOfElements(id, []) && !crossesAny(plain, foreign)) {
      points = []
      path = plain
    } else {
      const found = search(id)
      if (typeof found === 'string') {
        failed.set(id, found)
        continue
      }
      points = found
        .slice(1, -1)
        .map((p) => ({ x: Math.round(p.x * 100) / 100, y: Math.round(p.y * 100) / 100 }))
      if (!clearOfElements(id, points)) {
        failed.set(id, 'the route found still touches an element')
        continue
      }
      path = flattenPath(
        buildEdgePath(
          'step',
          entry.from,
          entry.to,
          points,
          DEFAULT_PREFERENCES.edgeStraightSegmentLength
        )
      )
    }
    routed.set(id, points)
    foreign.push(path)
    ingest(grid, path)
  }
  return { routed, failed }
}
