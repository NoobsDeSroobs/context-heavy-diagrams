// Geometry of an SVG path string without a DOM: the paths this app draws use only the absolute
// commands M, L, C, Q and Z (edgePath.ts, bendablePath.ts, orthogonalPath.ts), so a small parser is
// enough. The SVG export (ADR 0124) uses it to put an edge label at a fraction of the path's length
// and to find the extent of the drawing; on screen the browser measures the same string.

export interface Point {
  x: number
  y: number
}

const CURVE_STEPS = 24

// The path flattened to a polyline: each curve becomes CURVE_STEPS straight pieces.
export function flattenPath(d: string): Point[] {
  const tokens = d.match(/[MLCQZ]|-?\d*\.?\d+(?:e[-+]?\d+)?/gi) ?? []
  const points: Point[] = []
  let command = ''
  let i = 0
  let start: Point | undefined
  const number = (): number => Number(tokens[i++])
  while (i < tokens.length) {
    const token = tokens[i]
    if (/^[MLCQZ]$/i.test(token)) {
      command = token.toUpperCase()
      i += 1
      if (command === 'Z' && start) points.push({ ...start })
      continue
    }
    const current = points[points.length - 1]
    if (command === 'M' || command === 'L') {
      const point = { x: number(), y: number() }
      if (command === 'M') start = point
      points.push(point)
      command = 'L'
    } else if (command === 'C' && current) {
      const c1 = { x: number(), y: number() }
      const c2 = { x: number(), y: number() }
      const end = { x: number(), y: number() }
      for (let s = 1; s <= CURVE_STEPS; s++) {
        const t = s / CURVE_STEPS
        const u = 1 - t
        points.push({
          x:
            u * u * u * current.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t * t * t * end.x,
          y: u * u * u * current.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t * t * t * end.y
        })
      }
    } else if (command === 'Q' && current) {
      const c = { x: number(), y: number() }
      const end = { x: number(), y: number() }
      for (let s = 1; s <= CURVE_STEPS; s++) {
        const t = s / CURVE_STEPS
        const u = 1 - t
        points.push({
          x: u * u * current.x + 2 * u * t * c.x + t * t * end.x,
          y: u * u * current.y + 2 * u * t * c.y + t * t * end.y
        })
      }
    } else {
      // A number with no command to use it on: not a path this app writes.
      i += 1
    }
  }
  return points
}

// The point at `ratio` (0-1) of the path's length, like SVGGeometryElement.getPointAtLength, with
// the length taken along the flattened polyline.
export function pointAtRatio(d: string, ratio: number): Point {
  const points = flattenPath(d)
  if (points.length === 0) return { x: 0, y: 0 }
  const lengths: number[] = [0]
  for (let i = 1; i < points.length; i++) {
    lengths.push(
      lengths[i - 1] + Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y)
    )
  }
  const total = lengths[lengths.length - 1]
  const target = Math.max(0, Math.min(1, ratio)) * total
  if (total === 0) return points[0]
  for (let i = 1; i < points.length; i++) {
    if (lengths[i] >= target) {
      const span = lengths[i] - lengths[i - 1]
      const f = span === 0 ? 0 : (target - lengths[i - 1]) / span
      return {
        x: points[i - 1].x + (points[i].x - points[i - 1].x) * f,
        y: points[i - 1].y + (points[i].y - points[i - 1].y) * f
      }
    }
  }
  return points[points.length - 1]
}
