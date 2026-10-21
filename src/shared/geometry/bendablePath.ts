import type { LinePoint } from '../diagram'

const DEFAULT_GRAVITY = 0.5

// A point in a connector's path: the persisted LinePoint plus a fixed outward `direction` (unit
// vector). A 'line' node's points never set it (there is no shape to leave "outward" from; see
// LineNode.tsx). An ordinary edge's two endpoints always do once rendered with `routingStyle:
// 'catmullRom'` (see LabeledEdge.tsx), since both ends are bound to a real node and "which way this
// edge leaves the shape's side" always exists. Renderer-only, never part of the persisted schema.
export interface PathPoint extends LinePoint {
  direction?: { x: number; y: number }
}

// Tangent at point i. A point with `direction` uses it, scaled by its own gravity and by the
// distance to its one real neighbour, the same scaling as the neighbour-based case below, so it
// responds to its gravity value like a plain point. The sign depends on the end (standard
// Hermite-tangent convention): at the first point the tangent is where the curve heads as it LEAVES
// (`direction` as-is); at the last point it is where the curve heads as it ARRIVES, INTO the shape,
// i.e. the negation of "outward". Using the same sign for both (a real bug) made the curve approach
// the target's side from the wrong side instead of arriving perpendicular to the shape. Everything
// else (a line's own points, an edge's manual bend points) uses per-point Catmull-Rom gravity
// (tension) via its neighbours (ADR 0050). A point with no direction and one neighbour uses that
// neighbour; an interior point uses both.
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

// Ordered point list -> SVG path string. It knows nothing of "node" or "edge" beyond PathPoint's
// `direction`: the point of the split (ADR 0050) is that the same curve math serves a decorative
// line's points and an edge's manual bend points (the "catmull-rom" routing style, ADR 0057). Each
// segment between consecutive points becomes one cubic bezier by the standard Hermite-to-Bezier
// conversion. A straight two-point line with no `direction` comes out straight whatever the
// gravity: both tangents are parallel to the chord, so both control points land on it.
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

// Straight lead-in/out before curving, at whichever ends have a `direction`: the global
// edgeStraightSegmentLength setting (preferences.ts/PreferencesPanel, ADR 0032), reused by
// catmull-rom edges (ADR 0057) alongside the bezier routing it first applied to. Offsets an
// endpoint outward along its direction by `length` (clamped to half the distance to its real
// neighbour in the original list, so a short segment can't overlap or fold back), builds the curve
// between the offset points, then splices each true endpoint back on with a literal straight `L`
// segment. Relies on buildBendablePath's output always starting "M<x>,<y> C..." (its actual, stable
// implementation, not just documented behaviour).
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
// right-clicking the rendered curve. Evaluates each segment's own cubic
// directly, so the module needs no DOM (the SVG export runs it in plain
// Node, ADR 0124).
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
    for (let s = 0; s <= SAMPLES_PER_SEGMENT; s++) {
      const t = s / SAMPLES_PER_SEGMENT
      const u = 1 - t
      const x = u * u * u * p0.x + 3 * u * u * t * c1x + 3 * u * t * t * c2x + t * t * t * p1.x
      const y = u * u * u * p0.y + 3 * u * u * t * c1y + 3 * u * t * t * c2y + t * t * t * p1.y
      const distance = Math.hypot(x - click.x, y - click.y)
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
export function pointsBoundingBox(points: LinePoint[]): {
  minX: number
  minY: number
  maxX: number
  maxY: number
} {
  const xs = points.map((p) => p.x)
  const ys = points.map((p) => p.y)
  return {
    minX: Math.min(...xs),
    minY: Math.min(...ys),
    maxX: Math.max(...xs),
    maxY: Math.max(...ys)
  }
}
