import type { LinePoint } from '@shared/diagram'

const DEFAULT_GRAVITY = 0.5

// A point in a connector's path, with one addition over the persisted
// LinePoint: a fixed outward `direction` (unit vector). A `'line'` node's
// own points never set this (nothing to leave "outward" from — see
// LineNode.tsx). An ordinary edge's two endpoints always do, once rendered
// with `routingStyle: 'catmullRom'` (see LabeledEdge.tsx) — "which way
// this edge leaves the shape's side" is a real, always-available thing for
// an edge (both ends are always bound to a real node), unlike a decorative
// line's points, which never have a side to leave from. Renderer-only,
// never part of the persisted schema.
export interface PathPoint extends LinePoint {
  direction?: { x: number; y: number }
}

// Tangent at point i. A point with `direction` uses that fixed direction,
// scaled by its own gravity and by distance to its one real neighbor —
// same scaling convention as the neighbor-based case below, so it still
// responds to its own gravity value the same way a plain point's does.
// Sign depends on which end it's at, standard Hermite-tangent convention:
// at the *first* point, the tangent is the direction the curve heads as it
// LEAVES (outward from the shape — `direction` as-is). At the *last*
// point, the tangent is the direction the curve heads as it ARRIVES —
// INTO the shape, i.e. the negation of "outward." Using the same sign for
// both (a real bug, found live-testing edge routing) makes the curve
// approach the target's side from the wrong side, connecting as if
// departing toward whatever it's attached to rather than arriving
// perpendicular to the shape. Everything else (a line's own points; an
// edge's own manual bend points) uses per-point Catmull-Rom "gravity"
// (tension) via its neighbor(s) — see
// docs/decisions/0050-freeform-line-as-node-type.md. A point with no
// direction and only one neighbor uses that single neighbor; an interior
// point uses both.
function tangentAt(points: PathPoint[], i: number): { x: number; y: number } {
  const point = points[i]
  const gravity = point.gravity ?? DEFAULT_GRAVITY
  if (point.direction) {
    const sign = i === points.length - 1 ? -1 : 1
    const neighbor = points[i - 1] ?? points[i + 1] ?? point
    const distance = Math.hypot(neighbor.x - point.x, neighbor.y - point.y)
    return {
      x: point.direction.x * distance * gravity * sign,
      y: point.direction.y * distance * gravity * sign
    }
  }
  const prev = points[i - 1] ?? point
  const next = points[i + 1] ?? point
  return { x: (next.x - prev.x) * gravity, y: (next.y - prev.y) * gravity }
}

// Ordered point list -> SVG path string. Deliberately no notion of "node"
// or "edge" here beyond PathPoint's own minimal `direction` field — the
// whole point of splitting this out (ADR 0050) is that the same
// curve math serves a decorative line's own points and an edge's manual
// bend points alike (the "catmull-rom" routing style, ADR 0057) without
// duplicating it. Each segment between consecutive points becomes one
// cubic bezier via the standard Hermite-to-Bezier conversion. A straight
// 2-point line with no `direction` on either end comes out perfectly
// straight regardless of gravity: both tangents are parallel to the
// chord, so both derived control points land exactly on it.
export function buildBendablePath(points: PathPoint[]): string {
  if (points.length === 0) return ''
  if (points.length === 1) return `M${points[0].x},${points[0].y}`

  const tangents = points.map((_, i) => tangentAt(points, i))
  let d = `M${points[0].x},${points[0].y}`
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i]
    const p1 = points[i + 1]
    const t0 = tangents[i]
    const t1 = tangents[i + 1]
    const c1x = p0.x + t0.x / 3
    const c1y = p0.y + t0.y / 3
    const c2x = p1.x - t1.x / 3
    const c2y = p1.y - t1.y / 3
    d += ` C${c1x},${c1y} ${c2x},${c2y} ${p1.x},${p1.y}`
  }
  return d
}

// Straight lead-in/out before curving, at whichever end(s) have a
// `direction` — the global edgeStraightSegmentLength setting (preferences.ts/
// PreferencesPanel, ADR 0032), reused by catmull-rom-routed edges
// (ADR 0057) alongside the bezier routing it originally applied to. Offsets an endpoint outward along its own direction by
// `length` (clamped to half the distance to its real neighbor in the
// original list, so a short segment can never overlap or fold back on
// itself), builds the underlying curve between those offset points, then
// splices each true endpoint back on with a literal straight `L` segment.
// Relies on buildBendablePath's output always starting "M<x>,<y> C..."
// (its actual, stable implementation, not just documented behavior).
export function buildConnectorPath(points: PathPoint[], straightSegmentLength: number): string {
  if (points.length < 2) return buildBendablePath(points)
  if (straightSegmentLength <= 0) return buildBendablePath(points)

  const withLeadSegments = points.map((p, i) => {
    if (!p.direction) return p
    const neighbor = i === 0 ? points[1] : points[points.length - 2]
    const distance = Math.hypot(neighbor.x - p.x, neighbor.y - p.y)
    const length = Math.min(straightSegmentLength, distance / 2)
    return { ...p, x: p.x + p.direction.x * length, y: p.y + p.direction.y * length }
  })

  const curve = buildBendablePath(withLeadSegments)
  const first = points[0]
  const last = points[points.length - 1]
  const rest = curve.slice(curve.indexOf(' '))
  return `M${first.x},${first.y} L${withLeadSegments[0].x},${withLeadSegments[0].y}${rest} L${last.x},${last.y}`
}

// Which segment (index i, between points[i] and points[i+1]) a click point
// is nearest to — used to insert a new point in the right place when
// right-clicking the rendered curve. Samples each segment's own bezier via
// a throwaway (never-inserted) SVG path, same technique LabeledEdge.tsx's
// pointAtRatio uses — SVG path geometry doesn't depend on DOM attachment,
// just the presence of the DOM API itself (renderer-only, like this whole
// module's caller).
export function nearestSegmentIndex(points: PathPoint[], click: { x: number; y: number }): number {
  let bestIndex = 0
  let bestDistance = Infinity
  const tangents = points.map((_, i) => tangentAt(points, i))
  const SAMPLES_PER_SEGMENT = 20
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i]
    const p1 = points[i + 1]
    const t0 = tangents[i]
    const t1 = tangents[i + 1]
    const c1x = p0.x + t0.x / 3
    const c1y = p0.y + t0.y / 3
    const c2x = p1.x - t1.x / 3
    const c2y = p1.y - t1.y / 3
    const segment = document.createElementNS('http://www.w3.org/2000/svg', 'path')
    segment.setAttribute('d', `M${p0.x},${p0.y} C${c1x},${c1y} ${c2x},${c2y} ${p1.x},${p1.y}`)
    const length = segment.getTotalLength()
    for (let s = 0; s <= SAMPLES_PER_SEGMENT; s++) {
      const point = segment.getPointAtLength((length * s) / SAMPLES_PER_SEGMENT)
      const distance = Math.hypot(point.x - click.x, point.y - click.y)
      if (distance < bestDistance) {
        bestDistance = distance
        bestIndex = i
      }
    }
  }
  return bestIndex
}

// Bounding box of the raw points only — doesn't account for stroke width
// or handle hit-target padding, callers add their own margin (see
// LineNode's LINE_BOUNDS_PADDING). 'line' nodes only; an edge has no
// bounding box of its own to maintain.
export function pointsBoundingBox(points: LinePoint[]): { minX: number; minY: number; maxX: number; maxY: number } {
  const xs = points.map((p) => p.x)
  const ys = points.map((p) => p.y)
  return { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) }
}
