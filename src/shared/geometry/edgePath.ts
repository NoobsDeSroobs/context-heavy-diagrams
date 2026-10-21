import type { EdgeStyle, LinePoint } from '../diagram'
import { buildConnectorPath, type PathPoint } from './bendablePath.ts'
import {
  orthogonalPath,
  orthogonalRouteVertices,
  SMOOTHSTEP_BORDER_RADIUS
} from './orthogonalPath.ts'
import type { Side } from './side.ts'

// The one place an edge's routing becomes an SVG path string. The canvas (LabeledEdge) and the SVG
// export (ADR 0124) both call buildEdgePath, so a diagram is drawn with the same geometry on screen
// and in the exported file.

// A point where an edge meets a node, plus the side of the node it leaves from.
export interface EdgeEnd {
  x: number
  y: number
  side: Side
}

// Outward from the node at each side — the direction an edge already travels leaving/entering a
// handle. Places the bezier routing's straight lead-in/out and is every point's fixed tangent
// direction under catmull-rom routing (see bendablePath.ts's PathPoint).
export const OUTWARD_DIRECTION: Record<Side, { x: number; y: number }> = {
  top: { x: 0, y: -1 },
  right: { x: 1, y: 0 },
  bottom: { x: 0, y: 1 },
  left: { x: -1, y: 0 }
}

// Port of getBezierPath from @xyflow/system (default curvature 0.25), path string only. A test
// compares it with the library's own output, so a change in the library is noticed.
const BEZIER_CURVATURE = 0.25

function controlOffset(distance: number): number {
  return distance >= 0 ? 0.5 * distance : BEZIER_CURVATURE * 25 * Math.sqrt(-distance)
}

function controlPoint(side: Side, from: EdgeEnd, to: EdgeEnd): [number, number] {
  switch (side) {
    case 'left':
      return [from.x - controlOffset(from.x - to.x), from.y]
    case 'right':
      return [from.x + controlOffset(to.x - from.x), from.y]
    case 'top':
      return [from.x, from.y - controlOffset(from.y - to.y)]
    case 'bottom':
      return [from.x, from.y + controlOffset(to.y - from.y)]
  }
}

export function bezierPath(source: EdgeEnd, target: EdgeEnd): string {
  const [sourceControlX, sourceControlY] = controlPoint(source.side, source, target)
  const [targetControlX, targetControlY] = controlPoint(target.side, target, source)
  return `M${source.x},${source.y} C${sourceControlX},${sourceControlY} ${targetControlX},${targetControlY} ${target.x},${target.y}`
}

// Straight lead-in/out before curving: the global edgeStraightSegmentLength setting (ADR 0032). It
// matters only for the two curvy routing styles (bezier, catmull-rom); straight/step/smoothstep
// already leave each side perpendicular. bezierPath has no lead-in, so the curve is run between two
// points offset straight outward from the real endpoints and a straight `L` segment splices each
// real endpoint onto that path string. Relies on bezierPath always starting "M<x>,<y> C..." (it is
// ours). Clamped to half the straight-line distance between the real endpoints so two short
// segments can't overlap or fold a short edge back on itself.
function bezierPathWithLeads(
  source: EdgeEnd,
  target: EdgeEnd,
  straightSegmentLength: number
): string {
  if (straightSegmentLength <= 0) return bezierPath(source, target)
  const distance = Math.hypot(target.x - source.x, target.y - source.y)
  const length = Math.min(straightSegmentLength, distance / 2)
  const sourceDir = OUTWARD_DIRECTION[source.side]
  const targetDir = OUTWARD_DIRECTION[target.side]
  const offsetSource: EdgeEnd = {
    x: source.x + sourceDir.x * length,
    y: source.y + sourceDir.y * length,
    side: source.side
  }
  const offsetTarget: EdgeEnd = {
    x: target.x + targetDir.x * length,
    y: target.y + targetDir.y * length,
    side: target.side
  }
  const curve = bezierPath(offsetSource, offsetTarget)
  return `M${source.x},${source.y} L${offsetSource.x},${offsetSource.y} ${curve.slice(curve.indexOf('C'))} L${target.x},${target.y}`
}

// Routing (ADR 0057): 'straight' is a plain line, 'step'/'smoothstep' are the right-angled routes of
// orthogonalPath.ts through the manual waypoints, 'catmullRom' reuses the freeform-line curve
// (bendablePath.ts) with the edge's bend points, and absent means a plain bezier.
export function buildEdgePath(
  routingStyle: EdgeStyle['routingStyle'],
  source: EdgeEnd,
  target: EdgeEnd,
  bendPoints: LinePoint[],
  straightSegmentLength: number
): string {
  switch (routingStyle) {
    case 'straight':
      return `M ${source.x},${source.y}L ${target.x},${target.y}`
    case 'step':
    case 'smoothstep': {
      const vertices = orthogonalRouteVertices(source, source.side, bendPoints, target, target.side)
      return orthogonalPath(vertices, routingStyle === 'step' ? 0 : SMOOTHSTEP_BORDER_RADIUS)
    }
    case 'catmullRom': {
      const pathPoints: PathPoint[] = [
        { x: source.x, y: source.y, direction: OUTWARD_DIRECTION[source.side] },
        ...bendPoints,
        { x: target.x, y: target.y, direction: OUTWARD_DIRECTION[target.side] }
      ]
      return buildConnectorPath(pathPoints, straightSegmentLength)
    }
    default:
      return bezierPathWithLeads(source, target, straightSegmentLength)
  }
}
