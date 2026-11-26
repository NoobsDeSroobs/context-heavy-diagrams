// React Flow draws an edge only while a box round its two end elements overlaps the window, and
// ignores where the path goes between them. An edge with waypoints can run well outside that box, so
// it vanished while most of it was in view. `waypointEdgeHidden` finds that case, so the canvas can
// draw everything for as long as it holds (docs/known-issues.md).

export interface Box {
  x: number
  y: number
  x2: number
  y2: number
}

export interface WaypointEdge {
  // The boxes of the source and target elements.
  ends: Box[]
  points: { x: number; y: number; gravity?: number }[]
}

function overlaps(a: Box, b: Box): boolean {
  return a.x < b.x2 && a.x2 > b.x && a.y < b.y2 && a.y2 > b.y
}

function around(boxes: Box[]): Box {
  return {
    x: Math.min(...boxes.map((b) => b.x)),
    y: Math.min(...boxes.map((b) => b.y)),
    x2: Math.max(...boxes.map((b) => b.x2)),
    y2: Math.max(...boxes.map((b) => b.y2))
  }
}

// The room a curve may take beyond its waypoints and ends, however little else says so.
const MIN_MARGIN = 100
// A waypoint without a gravity of its own (bendablePath.ts).
const DEFAULT_GRAVITY = 0.5

// How far a curve can swing past the waypoints: each cubic piece stays inside its control points,
// which lie a third of a tangent from the point, and a tangent is the span between the neighbours
// times the gravity. The ends are taken at the middle of their boxes.
function margin(edge: WaypointEdge): number {
  const centre = (b: Box): { x: number; y: number } => ({
    x: (b.x + b.x2) / 2,
    y: (b.y + b.y2) / 2
  })
  const chain = [centre(edge.ends[0]), ...edge.points, centre(edge.ends[edge.ends.length - 1])]
  let swing = 0
  for (let i = 1; i < chain.length - 1; i++) {
    const span = Math.hypot(chain[i + 1].x - chain[i - 1].x, chain[i + 1].y - chain[i - 1].y)
    const gravity = (chain[i] as { gravity?: number }).gravity ?? DEFAULT_GRAVITY
    swing = Math.max(swing, (span * gravity) / 3)
  }
  return Math.max(MIN_MARGIN, swing)
}

// True when some edge's waypoints and ends reach into the window while its end elements alone do
// not, which is when React Flow would leave the edge out.
export function waypointEdgeHidden(edges: WaypointEdge[], view: Box): boolean {
  return edges.some((edge) => {
    if (edge.ends.length === 0) return false
    const ends = around(edge.ends)
    if (overlaps(ends, view)) return false
    const reach = around([ends, ...edge.points.map((p) => ({ x: p.x, y: p.y, x2: p.x, y2: p.y }))])
    const room = margin(edge)
    return overlaps(
      { x: reach.x - room, y: reach.y - room, x2: reach.x2 + room, y2: reach.y2 + room },
      view
    )
  })
}
