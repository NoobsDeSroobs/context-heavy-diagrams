import type { LinePoint } from '../diagram'
import type { Side } from './side'

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

function axisForSide(side: Side): Axis {
  return side === 'left' || side === 'right' ? 'h' : 'v'
}

// The length of the short run that takes an edge out of an element, or into one, when the route has
// to turn at once: out along the side the edge is attached to before it goes anywhere else.
export const END_STUB = 20
// A handle on a segment that touches the source or the target needs room for a stub besides.
const MIN_END_HANDLE_LENGTH = 2 * END_STUB

// The unit vector pointing out of an element through `side`.
function outward(side: Side): OrthoPoint {
  switch (side) {
    case 'right':
      return { x: 1, y: 0 }
    case 'left':
      return { x: -1, y: 0 }
    case 'bottom':
      return { x: 0, y: 1 }
    default:
      return { x: 0, y: -1 }
  }
}

export interface OrthoEnds {
  sourceSide: Side
  targetSide: Side
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
  sourceSide: Side,
  t: OrthoPoint,
  targetSide: Side
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
//
// An edge leaves its source along the side it is attached to and arrives at its target along the
// target's side. When the leg to the first (or from the last) waypoint would run back into the
// element it joins, the route first takes a stub of END_STUB straight out of the element, so a
// single waypoint above two facing elements goes round them instead of up and straight back down.
// A leg already in line with the end stays as it is: a straight line through the elements is what
// the person drew.
export function orthogonalRouteVertices(
  source: OrthoPoint,
  sourceSide: Side,
  waypoints: OrthoPoint[],
  target: OrthoPoint,
  targetSide: Side
): OrthoPoint[] {
  if (waypoints.length === 0) return defaultVertices(source, sourceSide, target, targetSide)

  const sAxis = axisForSide(sourceSide)
  const tAxis = axisForSide(targetSide)
  const sOut = outward(sourceSide)
  const tOut = outward(targetSide)
  const inLine = (a: OrthoPoint, b: OrthoPoint): boolean => alignedH(a, b) || alignedV(a, b)

  // `first`: the axis the leg into this anchor travels along first; absent means the axis the route
  // was already travelling along.
  const anchors: { p: OrthoPoint; first?: Axis }[] = waypoints.map((p) => ({ p }))
  const out: OrthoPoint[] = [source]
  let lastAxis: Axis = sAxis

  const firstWaypoint = waypoints[0]
  const sourceLeg = sAxis === 'h' ? firstWaypoint.x - source.x : firstWaypoint.y - source.y
  const sourceDir = sAxis === 'h' ? sOut.x : sOut.y
  if (!inLine(source, firstWaypoint) && sourceLeg * sourceDir < 0) {
    out.push({ x: source.x + sOut.x * END_STUB, y: source.y + sOut.y * END_STUB })
    lastAxis = sAxis === 'h' ? 'v' : 'h'
  }

  const lastWaypoint = waypoints[waypoints.length - 1]
  const targetLeg = tAxis === 'h' ? target.x - lastWaypoint.x : target.y - lastWaypoint.y
  const targetDir = tAxis === 'h' ? tOut.x : tOut.y
  if (!inLine(lastWaypoint, target) && targetLeg * targetDir > 0) {
    anchors.push({
      p: { x: target.x + tOut.x * END_STUB, y: target.y + tOut.y * END_STUB },
      first: tAxis
    })
  }
  anchors.push({ p: target })

  for (let i = 0; i < anchors.length; i++) {
    const prev = out[out.length - 1]
    const { p, first } = anchors[i]
    if (near(prev, p)) continue
    if (alignedH(prev, p) || alignedV(prev, p)) {
      out.push(p)
      lastAxis = alignedV(prev, p) ? 'v' : 'h'
      continue
    }
    // The leg into the target should arrive along the target's own axis;
    // every other corner just continues on the axis the previous leg used,
    // which keeps the number of corners minimal.
    const isTarget = i === anchors.length - 1
    const firstAxis: Axis = first ?? (isTarget ? (tAxis === 'h' ? 'v' : 'h') : lastAxis)
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

// The point of the drawn route nearest `click`: where a new waypoint goes so it lies on a segment
// instead of a few units beside it, which would draw a jog at each end of the stubs.
export function nearestPointOnRoute(vertices: OrthoPoint[], click: OrthoPoint): OrthoPoint {
  let best: OrthoPoint = vertices[0]
  let bestDist = Infinity
  for (let i = 0; i < vertices.length - 1; i++) {
    const a = vertices[i]
    const b = vertices[i + 1]
    const dx = b.x - a.x
    const dy = b.y - a.y
    const lenSq = dx * dx + dy * dy
    const t =
      lenSq < EPS
        ? 0
        : Math.max(0, Math.min(1, ((click.x - a.x) * dx + (click.y - a.y) * dy) / lenSq))
    const p = { x: a.x + t * dx, y: a.y + t * dy }
    const d = dist(click, p)
    if (d < bestDist) {
      bestDist = d
      best = p
    }
  }
  return best
}

function segmentAxis(a: OrthoPoint, b: OrthoPoint): Axis {
  return Math.abs(a.y - b.y) <= Math.abs(a.x - b.x) ? 'h' : 'v'
}

// Drag handles for the straight segments of the path. A segment between two bends gets one if it is
// long enough to grab. A segment that touches the source or the target gets one too, but only when
// it runs along the side the edge is attached to and has room for a stub as well: dragging it
// sideways moves it and the edge leaves the element by a stub (see moveOrthogonalSegment). Without
// `ends` only the segments between bends are offered.
export function orthogonalSegments(vertices: OrthoPoint[], ends?: OrthoEnds): OrthoSegment[] {
  const segments: OrthoSegment[] = []
  const lastIndex = vertices.length - 2
  for (let i = 0; i <= lastIndex; i++) {
    const a = vertices[i]
    const b = vertices[i + 1]
    const length = dist(a, b)
    const axis = segmentAxis(a, b)
    const touchesSource = i === 0
    const touchesTarget = i === lastIndex
    if (touchesSource || touchesTarget) {
      if (!ends) continue
      if (touchesSource && axis !== axisForSide(ends.sourceSide)) continue
      if (touchesTarget && axis !== axisForSide(ends.targetSide)) continue
      if (length < MIN_END_HANDLE_LENGTH) continue
    } else if (length < MIN_HANDLE_SEGMENT_LENGTH) {
      continue
    }
    segments.push({ index: i, a, b, axis, mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, length })
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

// The corner right outside the source (or the target), where the route turns off the side it is
// attached to, is drawn by orthogonalRouteVertices whenever the next point is a column (or row)
// away, so it need not be stored.
function dropImpliedCorners(vertices: OrthoPoint[], ends: OrthoEnds): OrthoPoint[] {
  const out = [...vertices]
  if (out.length >= 4) {
    const [s, w1, w2] = out
    const d = outward(ends.sourceSide)
    const along = axisForSide(ends.sourceSide)
    const onSide = along === 'h' ? alignedH(s, w1) : alignedV(s, w1)
    const forward = (w1.x - s.x) * d.x + (w1.y - s.y) * d.y > 0
    const turns = along === 'h' ? alignedV(w1, w2) : alignedH(w1, w2)
    if (onSide && forward && turns) out.splice(1, 1)
  }
  if (out.length >= 4) {
    const n = out.length
    const [w2, w1, t] = [out[n - 3], out[n - 2], out[n - 1]]
    const d = outward(ends.targetSide)
    const along = axisForSide(ends.targetSide)
    const onSide = along === 'h' ? alignedH(t, w1) : alignedV(t, w1)
    const forward = (w1.x - t.x) * d.x + (w1.y - t.y) * d.y > 0
    const turns = along === 'h' ? alignedV(w1, w2) : alignedH(w1, w2)
    if (onSide && forward && turns) out.splice(n - 2, 1)
  }
  return out
}

// Move one segment of the expanded path along its normal to `value` (a y for a
// horizontal segment, an x for a vertical one) and return the new manual
// waypoint list (interior vertices only). `simplifyResult` is false during an
// in-progress drag (keeps vertex indices stable so the handle a gesture holds
// keeps meaning the same segment) and true on drop (redundant corners dropped).
//
// A segment that touches the source or the target cannot move that end, so the edge leaves the
// element by a stub of END_STUB along its side and turns onto the moved segment there; dragging
// the only segment of a straight edge makes a stub at each end.
export function moveOrthogonalSegment(
  vertices: OrthoPoint[],
  segmentIndex: number,
  axis: Axis,
  value: number,
  simplifyResult: boolean,
  ends: OrthoEnds
): LinePoint[] {
  const k = segmentIndex
  const source = vertices[0]
  const target = vertices[vertices.length - 1]
  const moved = (v: OrthoPoint): OrthoPoint =>
    axis === 'h' ? { x: v.x, y: value } : { x: value, y: v.y }
  // Where the moved segment meets the stub out of an end.
  const stubAt = (end: OrthoPoint, side: Side): OrthoPoint => {
    const d = outward(side)
    return axis === 'h'
      ? { x: end.x + d.x * END_STUB, y: value }
      : { x: value, y: end.y + d.y * END_STUB }
  }

  const isFirst = k === 0
  const isLast = k + 1 === vertices.length - 1

  // A neighbour on the same line (a waypoint on a straight run splits it in two) is not carried
  // along: the point where the two met stays, so a bridge across the gap the move opens is kept
  // there instead of the moved row growing to cover the neighbour.
  const parallel = (i: number): boolean =>
    i >= 0 && i + 1 < vertices.length && segmentAxis(vertices[i], vertices[i + 1]) === axis
  const bridgeBefore = !isFirst && parallel(k - 1) ? [vertices[k]] : []
  const bridgeAfter = !isLast && parallel(k + 1) ? [vertices[k + 1]] : []

  let inner: OrthoPoint[]
  if (isFirst && isLast) {
    inner = [stubAt(source, ends.sourceSide), stubAt(target, ends.targetSide)]
  } else if (isFirst) {
    inner = [
      stubAt(source, ends.sourceSide),
      moved(vertices[1]),
      ...bridgeAfter,
      ...vertices.slice(2, vertices.length - 1)
    ]
  } else if (isLast) {
    inner = [
      ...vertices.slice(1, k),
      ...bridgeBefore,
      moved(vertices[k]),
      stubAt(target, ends.targetSide)
    ]
  } else {
    inner = [
      ...vertices.slice(1, k),
      ...bridgeBefore,
      moved(vertices[k]),
      moved(vertices[k + 1]),
      ...bridgeAfter,
      ...vertices.slice(k + 2, vertices.length - 1)
    ]
  }

  const next = [source, ...inner, target]
  const resolved = simplifyResult ? dropImpliedCorners(simplify(next), ends) : next
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
