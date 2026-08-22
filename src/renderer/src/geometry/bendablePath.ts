import type { LinePoint } from '@shared/diagram'

const DEFAULT_GRAVITY = 0.5

// Tangent at point i via per-point Catmull-Rom "gravity" (tension) — see
// docs/decisions/0050-freeform-line-as-node-type.md. An endpoint uses its
// single neighbor; an interior point uses both.
function tangentAt(points: LinePoint[], i: number): { x: number; y: number } {
  const gravity = points[i].gravity ?? DEFAULT_GRAVITY
  const prev = points[i - 1] ?? points[i]
  const next = points[i + 1] ?? points[i]
  return { x: (next.x - prev.x) * gravity, y: (next.y - prev.y) * gravity }
}

// Ordered point list -> SVG path string. Deliberately no notion of "node"
// or "edge" here — the whole point of splitting this out is that a future
// bendable edge type can reuse it verbatim (see ADR 0050's Alternatives).
// Each segment between consecutive points becomes one cubic bezier via the
// standard Hermite-to-Bezier conversion. A straight 2-point line comes out
// perfectly straight regardless of gravity: both tangents are parallel to
// the chord, so both derived control points land exactly on it.
export function buildBendablePath(points: LinePoint[]): string {
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

// Which segment (index i, between points[i] and points[i+1]) a click point
// is nearest to — used to insert a new point in the right place when
// right-clicking the rendered curve. Samples each segment's own bezier via
// a throwaway (never-inserted) SVG path, same technique LabeledEdge.tsx's
// pointAtRatio uses — SVG path geometry doesn't depend on DOM attachment,
// just the presence of the DOM API itself (renderer-only, like this whole
// module's caller).
export function nearestSegmentIndex(points: LinePoint[], click: { x: number; y: number }): number {
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
// LineNode's LINE_BOUNDS_PADDING).
export function pointsBoundingBox(points: LinePoint[]): { minX: number; minY: number; maxX: number; maxY: number } {
  const xs = points.map((p) => p.x)
  const ys = points.map((p) => p.y)
  return { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) }
}
