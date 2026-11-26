// The edges that cross the border of a container, and where they do. Derived from the diagram,
// never stored. A container is a lane, an element's lane is the container it has as its parent, and an
// edge crosses a border when one end is inside the container and the other is not.

export interface Point {
  x: number
  y: number
}

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

// The containers around an element, nearest first, by following `parentOf`. A loop in the parents
// (a broken file) ends the walk.
export function ancestorsOf(id: string, parentOf: (id: string) => string | undefined): string[] {
  const out: string[] = []
  const seen = new Set<string>([id])
  let current = parentOf(id)
  while (current !== undefined && !seen.has(current)) {
    out.push(current)
    seen.add(current)
    current = parentOf(current)
  }
  return out
}

export interface EdgeCrossing {
  // The containers the edge leaves, innermost first, and those it enters, outermost first: one border
  // each, so an edge out of a group in a lane and into another lane has three.
  leaving: string[]
  entering: string[]
}

// What an edge crosses, or null when it stays in one container (or outside all of them). An edge
// between a container and an element inside it crosses nothing: it is attached to the container's own
// border.
export function edgeCrossing(
  sourceId: string,
  targetId: string,
  parentOf: (id: string) => string | undefined
): EdgeCrossing | null {
  if (sourceId === targetId) return null
  const fromSource = ancestorsOf(sourceId, parentOf)
  const fromTarget = ancestorsOf(targetId, parentOf)
  if (fromSource.includes(targetId) || fromTarget.includes(sourceId)) return null
  const around = new Set(fromTarget)
  const insideSource = new Set(fromSource)
  const leaving = fromSource.filter((id) => !around.has(id))
  const entering = fromTarget.filter((id) => !insideSource.has(id)).reverse()
  return leaving.length > 0 || entering.length > 0 ? { leaving, entering } : null
}

// The route of a crossing by container name, for a person to read: "Billing › Sales → Finance" is out
// of a group in Sales and into Finance. Outside every container is "outside".
export function crossingText(
  crossing: EdgeCrossing,
  nameOf: (containerId: string) => string
): string {
  const side = (ids: string[]): string =>
    ids.length === 0 ? 'outside' : ids.map(nameOf).join(' › ')
  return `${side(crossing.leaving)} → ${side(crossing.entering)}`
}

// A gate drawn where an edge goes through a container's border: a short bar lying along the border,
// so horizontal on a horizontal border and vertical on a vertical one, whatever the angle of the edge.
export interface Gate {
  x: number
  y: number
  axis: 'horizontal' | 'vertical'
  containerId: string
}

// An amber that reads on both page colours.
export const GATE_COLOR = { dark: '#e0a43a', light: '#b8741a' } as const
export const GATE_LENGTH = 18
export const GATE_WIDTH = 4
// A gate is drawn with round ends, like the rest of the diagram's corners; the ends add half a line
// width each, so the line between them is this much to either side of the crossing.
export const GATE_HALF = (GATE_LENGTH - GATE_WIDTH) / 2

// Where a path (as points) crosses the borders of these containers. A crossing exactly on a corner is
// counted once.
export function gatesOnPath(points: Point[], boundaries: { id: string; rect: Rect }[]): Gate[] {
  const gates: Gate[] = []
  for (const { id, rect } of boundaries) {
    const left = rect.x
    const right = rect.x + rect.width
    const top = rect.y
    const bottom = rect.y + rect.height
    const found: Gate[] = []
    for (let i = 0; i + 1 < points.length; i++) {
      const p = points[i]
      const q = points[i + 1]
      for (const y of [top, bottom]) {
        if (p.y < y === q.y < y) continue
        const x = p.x + ((y - p.y) / (q.y - p.y)) * (q.x - p.x)
        if (x >= left && x <= right) found.push({ x, y, axis: 'horizontal', containerId: id })
      }
      for (const x of [left, right]) {
        if (p.x < x === q.x < x) continue
        const y = p.y + ((x - p.x) / (q.x - p.x)) * (q.y - p.y)
        if (y >= top && y <= bottom) found.push({ x, y, axis: 'vertical', containerId: id })
      }
    }
    for (const gate of found) {
      if (!gates.some((g) => g.containerId === id && Math.hypot(g.x - gate.x, g.y - gate.y) < 1)) {
        gates.push(gate)
      }
    }
  }
  return gates
}
