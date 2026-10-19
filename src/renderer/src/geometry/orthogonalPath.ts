import { Position } from '@xyflow/react'
import type { LinePoint } from '@shared/diagram'

// Right-angled ("step" / "smoothstep") edge routing with manual, draggable
// segments — ADR 0077. Deliberately self-contained and with NO dependency on
// bendablePath.ts (the catmull-rom curve module): the two routing families
// share only the persisted `DiagramEdge.points` array shape, never code, so a
// change here cannot regress catmull-rom-routed edges. `gravity` on a point is
// ignored by everything in this module.

export interface OrthoPoint {
  x: number
  y: number
}

type Axis = 'h' | 'v'

// A rendered segment of the expanded orthogonal polyline — one straight run
// between two consecutive vertices, always axis-aligned. `index` is the
// segment's position in the expanded vertex list (segment i joins vertex i and
// i+1), the handle identity a drag holds onto for the whole gesture.
export interface OrthoSegment {
  index: number
  a: OrthoPoint
  b: OrthoPoint
  axis: Axis
  mid: OrthoPoint
  length: number
}

// Below this a segment is too short to show a usable drag handle on.
const MIN_HANDLE_SEGMENT_LENGTH = 16
// Corner-rounding radius for 'smoothstep' — matches React Flow's own
// getSmoothStepPath default so the pristine (no-waypoint) path looks the same
// as it did before this app took over rendering it.
export const SMOOTHSTEP_BORDER_RADIUS = 5

// Tolerance for treating two coordinates as equal when building the path
// geometry — deliberately tight so corners land where they should.
const EPS = 0.5
// Looser tolerance for the on-release simplify pass: how close a dragged
// segment has to get to its neighbours before the now-redundant waypoints
// between them collapse away. A few px of slack so a near-miss drag still
// snaps clean instead of leaving a barely-visible jog.
const COLLAPSE_TOLERANCE = 5

function axisForSide(side: Position): Axis {
  return side === Position.Left || side === Position.Right ? 'h' : 'v'
}

function near(a: OrthoPoint, b: OrthoPoint): boolean {
  return Math.abs(a.x - b.x) < EPS && Math.abs(a.y - b.y) < EPS
}

function alignedH(a: OrthoPoint, b: OrthoPoint): boolean {
  return Math.abs(a.y - b.y) < EPS
}

function alignedV(a: OrthoPoint, b: OrthoPoint): boolean {
  return Math.abs(a.x - b.x) < EPS
}

function dist(a: OrthoPoint, b: OrthoPoint): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

// r units from `from` toward `to`, clamped so it never overshoots the segment.
function towards(from: OrthoPoint, to: OrthoPoint, r: number): OrthoPoint {
  const d = dist(from, to)
  if (d < EPS) return { ...from }
  const t = Math.min(r, d) / d
  return { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t }
}

// The classic right-angled shape for an edge with no manual waypoints: a
// centered crossbar when both ends face along the same axis, a single corner
// otherwise. Mirrors getSmoothStepPath's common-case output.
function defaultVertices(
  s: OrthoPoint,
  sourceSide: Position,
  t: OrthoPoint,
  targetSide: Position
): OrthoPoint[] {
  if (near(s, t)) return [s, t]
  if (alignedH(s, t) || alignedV(s, t)) return [s, t]
  const sAxis = axisForSide(sourceSide)
  const tAxis = axisForSide(targetSide)
  if (sAxis === 'h' && tAxis === 'h') {
    const midX = (s.x + t.x) / 2
    return [s, { x: midX, y: s.y }, { x: midX, y: t.y }, t]
  }
  if (sAxis === 'v' && tAxis === 'v') {
    const midY = (s.y + t.y) / 2
    return [s, { x: s.x, y: midY }, { x: t.x, y: midY }, t]
  }
  // Mixed axes — one corner is enough. Leave the source along its own axis.
  return sAxis === 'h' ? [s, { x: t.x, y: s.y }, t] : [s, { x: s.x, y: t.y }, t]
}

// Full vertex list (source first, target last) for a right-angled path that
// passes through every manual waypoint, inserting one synthetic corner between
// any two consecutive anchors that aren't already axis-aligned. Synthetic
// corners are never persisted — only `waypoints` is.
export function orthogonalRouteVertices(
  source: OrthoPoint,
  sourceSide: Position,
  waypoints: OrthoPoint[],
  target: OrthoPoint,
  targetSide: Position
): OrthoPoint[] {
  if (waypoints.length === 0) return defaultVertices(source, sourceSide, target, targetSide)

  const anchors = [source, ...waypoints, target]
  const out: OrthoPoint[] = [source]
  let lastAxis: Axis = axisForSide(sourceSide)
  for (let i = 1; i < anchors.length; i++) {
    const prev = out[out.length - 1]
    const p = anchors[i]
    if (near(prev, p)) continue
    if (alignedH(prev, p) || alignedV(prev, p)) {
      out.push(p)
      lastAxis = alignedV(prev, p) ? 'v' : 'h'
      continue
    }
    // The leg into the target should arrive along the target's own axis;
    // every other corner just continues on the axis the previous leg used,
    // which keeps the number of corners minimal.
    const firstAxis: Axis =
      i === anchors.length - 1 ? (axisForSide(targetSide) === 'h' ? 'v' : 'h') : lastAxis
    const corner: OrthoPoint = firstAxis === 'h' ? { x: p.x, y: prev.y } : { x: prev.x, y: p.y }
    if (!near(corner, prev) && !near(corner, p)) out.push(corner)
    out.push(p)
    lastAxis = firstAxis === 'h' ? 'v' : 'h'
  }
  return out
}

// Expanded vertex list -> SVG path string. `borderRadius > 0` rounds each
// interior corner with a quadratic, same as getSmoothStepPath; 0 gives sharp
// corners ('step').
export function orthogonalPath(vertices: OrthoPoint[], borderRadius: number): string {
  if (vertices.length < 2) return ''
  const [first] = vertices
  if (borderRadius <= 0 || vertices.length === 2) {
    return (
      `M${first.x},${first.y}` +
      vertices
        .slice(1)
        .map((v) => ` L${v.x},${v.y}`)
        .join('')
    )
  }
  let d = `M${first.x},${first.y}`
  for (let i = 1; i < vertices.length - 1; i++) {
    const prev = vertices[i - 1]
    const cur = vertices[i]
    const next = vertices[i + 1]
    const enter = towards(cur, prev, Math.min(borderRadius, dist(prev, cur) / 2))
    const exit = towards(cur, next, Math.min(borderRadius, dist(cur, next) / 2))
    d += ` L${enter.x},${enter.y} Q${cur.x},${cur.y} ${exit.x},${exit.y}`
  }
  const last = vertices[vertices.length - 1]
  d += ` L${last.x},${last.y}`
  return d
}

// Drag handles for the "interior" segments of the path: those whose two ends are both bend
// vertices, never the edge's fixed source or target. This is a deliberate v1 scope line (ADR 0077):
// moving a segment attached to a fixed endpoint means synthesising a perpendicular stub so the
// endpoint stays put, which is where the fiddliness and risk live. The common case, the mid
// crossbar of a step edge between two facing shapes, is an interior segment. An L-shaped edge
// (perpendicular sides, no interior segment) has no draggable segment until a waypoint is added via
// "Add point here". Segments shorter than MIN_HANDLE_SEGMENT_LENGTH are skipped too (nothing usable
// to grab).
export function orthogonalSegments(vertices: OrthoPoint[]): OrthoSegment[] {
  const segments: OrthoSegment[] = []
  for (let i = 1; i < vertices.length - 2; i++) {
    const a = vertices[i]
    const b = vertices[i + 1]
    const length = dist(a, b)
    if (length < MIN_HANDLE_SEGMENT_LENGTH) continue
    segments.push({
      index: i,
      a,
      b,
      axis: Math.abs(a.y - b.y) <= Math.abs(a.x - b.x) ? 'h' : 'v',
      mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
      length
    })
  }
  return segments
}

// Drop consecutive near-duplicates and any interior vertex that's nearly
// collinear with both its neighbours (a redundant corner). Uses
// COLLAPSE_TOLERANCE, not the tight EPS, so a not-quite-aligned drag still
// snaps clean. Endpoints (index 0 and last) are never removed — they're the
// edge's real source/target.
function simplify(vertices: OrthoPoint[]): OrthoPoint[] {
  const t = COLLAPSE_TOLERANCE
  const deduped = vertices.filter(
    (v, i) =>
      i === 0 || Math.abs(v.x - vertices[i - 1].x) >= t || Math.abs(v.y - vertices[i - 1].y) >= t
  )
  if (deduped.length <= 2) return deduped
  const out: OrthoPoint[] = [deduped[0]]
  for (let i = 1; i < deduped.length - 1; i++) {
    const a = out[out.length - 1]
    const b = deduped[i]
    const c = deduped[i + 1]
    const collinearV = Math.abs(a.x - b.x) < t && Math.abs(b.x - c.x) < t
    const collinearH = Math.abs(a.y - b.y) < t && Math.abs(b.y - c.y) < t
    if (collinearV || collinearH) continue
    out.push(b)
  }
  out.push(deduped[deduped.length - 1])
  return out
}

// Move one segment of the expanded path along its normal to `value` (a y for a
// horizontal segment, an x for a vertical one) and return the new manual
// waypoint list (interior vertices only). `simplifyResult` is false during an
// in-progress drag (keeps vertex indices stable so the handle a gesture holds
// keeps meaning the same segment) and true on drop (redundant corners dropped).
//
// The isFirst / isLast branches synthesise a perpendicular stub so a fixed
// endpoint stays put. orthogonalSegments() never emits a handle for an
// endpoint-adjacent segment in v1, so from the UI only the `else` branch runs;
// the stub branches are kept as a correct fallback for any future caller.
export function moveOrthogonalSegment(
  vertices: OrthoPoint[],
  segmentIndex: number,
  axis: Axis,
  value: number,
  simplifyResult: boolean
): LinePoint[] {
  const k = segmentIndex
  const left = vertices[k]
  const right = vertices[k + 1]
  const movedLeft: OrthoPoint = axis === 'h' ? { x: left.x, y: value } : { x: value, y: left.y }
  const movedRight: OrthoPoint = axis === 'h' ? { x: right.x, y: value } : { x: value, y: right.y }

  const isFirst = k === 0
  const isLast = k + 1 === vertices.length - 1

  let next: OrthoPoint[]
  if (isFirst && isLast) {
    next = [vertices[0], movedLeft, movedRight, vertices[vertices.length - 1]]
  } else if (isFirst) {
    next = [vertices[0], movedLeft, movedRight, ...vertices.slice(2)]
  } else if (isLast) {
    next = [...vertices.slice(0, k), movedLeft, movedRight, vertices[vertices.length - 1]]
  } else {
    next = [...vertices.slice(0, k), movedLeft, movedRight, ...vertices.slice(k + 2)]
  }

  const resolved = simplifyResult ? simplify(next) : next
  return resolved.slice(1, -1).map((p) => ({ x: p.x, y: p.y }))
}

// Which gap in [source, ...waypoints, target] a click is nearest to — the
// insertion index for a new manual waypoint. Projects the click onto each
// straight chord; synthetic corners are irrelevant to ordering.
export function nearestWaypointGap(
  source: OrthoPoint,
  waypoints: OrthoPoint[],
  target: OrthoPoint,
  click: OrthoPoint
): number {
  const anchors = [source, ...waypoints, target]
  let best = 0
  let bestDist = Infinity
  for (let i = 0; i < anchors.length - 1; i++) {
    const a = anchors[i]
    const b = anchors[i + 1]
    const dx = b.x - a.x
    const dy = b.y - a.y
    const lenSq = dx * dx + dy * dy
    const t =
      lenSq < EPS
        ? 0
        : Math.max(0, Math.min(1, ((click.x - a.x) * dx + (click.y - a.y) * dy) / lenSq))
    const px = a.x + t * dx
    const py = a.y + t * dy
    const d = Math.hypot(click.x - px, click.y - py)
    if (d < bestDist) {
      bestDist = d
      best = i
    }
  }
  return best
}
