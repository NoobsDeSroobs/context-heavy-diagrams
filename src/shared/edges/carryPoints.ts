// Manual edge points are absolute canvas positions, so moving elements leaves them behind. When both
// ends of an edge move by the same amount, whatever the reason (a drag, a container drag, a nudge, an
// alignment, an assistant's move), the points go along (ADR 0189). Pure: the renderer and the
// assistant operations each call it with their own node and edge shapes.

export interface PlacedNode {
  id: string
  // A child's `position` is relative to its parent's, to any depth.
  parentId?: string
  position: { x: number; y: number }
  // When both are given and differ between the two states the node was resized, not moved.
  width?: number
  height?: number
}

export interface Shift {
  dx: number
  dy: number
}

const SAME = 1e-6

export function absolutePositions(
  nodes: readonly PlacedNode[]
): Map<string, { x: number; y: number }> {
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const out = new Map<string, { x: number; y: number }>()
  for (const node of nodes) {
    let x = node.position.x
    let y = node.position.y
    const seen = new Set([node.id])
    for (let p = node.parentId; p !== undefined && !seen.has(p);) {
      const parent = byId.get(p)
      if (!parent) break
      x += parent.position.x
      y += parent.position.y
      seen.add(p)
      p = parent.parentId
    }
    out.set(node.id, { x, y })
  }
  return out
}

// How far each node's absolute position moved between two states of the same diagram. A node that
// did not move, was resized, or is in only one of the states has no entry.
export function nodeShifts(
  before: readonly PlacedNode[],
  after: readonly PlacedNode[]
): Map<string, Shift> {
  const was = absolutePositions(before)
  const is = absolutePositions(after)
  const sizeBefore = new Map(before.map((n) => [n.id, n]))
  const shifts = new Map<string, Shift>()
  for (const node of after) {
    const a = was.get(node.id)
    const b = is.get(node.id)
    const old = sizeBefore.get(node.id)
    if (!a || !b || !old) continue
    if (node.width !== old.width || node.height !== old.height) continue
    const dx = b.x - a.x
    const dy = b.y - a.y
    if (Math.abs(dx) > SAME || Math.abs(dy) > SAME) shifts.set(node.id, { dx, dy })
  }
  return shifts
}

// The shift an edge's points should take: both ends moved, by the same amount. Otherwise none.
export function edgeShift(
  shifts: ReadonlyMap<string, Shift>,
  source: string,
  target: string
): Shift | null {
  const a = shifts.get(source)
  const b = shifts.get(target)
  if (!a || !b) return null
  if (Math.abs(a.dx - b.dx) > SAME || Math.abs(a.dy - b.dy) > SAME) return null
  return a
}

export function shiftPoints<P extends { x: number; y: number }>(
  points: readonly P[],
  by: Shift
): P[] {
  return points.map((p) => ({ ...p, x: p.x + by.dx, y: p.y + by.dy }))
}
