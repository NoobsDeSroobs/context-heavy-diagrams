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
  points: { x: number; y: number }[]
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

// A curve through a waypoint can swing past it, so the reach is padded.
const CURVE_MARGIN = 100

// True when some edge's waypoints and ends reach into the window while its end elements alone do
// not, which is when React Flow would leave the edge out.
export function waypointEdgeHidden(edges: WaypointEdge[], view: Box): boolean {
  return edges.some((edge) => {
    if (edge.ends.length === 0) return false
    const ends = around(edge.ends)
    if (overlaps(ends, view)) return false
    const reach = around([ends, ...edge.points.map((p) => ({ x: p.x, y: p.y, x2: p.x, y2: p.y }))])
    return overlaps(
      {
        x: reach.x - CURVE_MARGIN,
        y: reach.y - CURVE_MARGIN,
        x2: reach.x2 + CURVE_MARGIN,
        y2: reach.y2 + CURVE_MARGIN
      },
      view
    )
  })
}
