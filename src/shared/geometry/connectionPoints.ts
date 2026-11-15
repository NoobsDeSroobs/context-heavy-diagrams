import type { ConnectionPoint, ConnectionPointSide } from '../diagram'

// The connection point model's pure geometry, shared by the canvas (nodes/connectionPoints.ts) and
// the SVG export (ADR 0124): which points a node's sides have, and where each one sits on a box.

const SIDES: ConnectionPointSide[] = ['top', 'right', 'bottom', 'left']

// Every side always has at least one point. A side with nothing in the node's stored
// `connectionPoints` implicitly has exactly one, centred (offset 0.5), with the side's own name as
// a stable id ("top"/"right"/"bottom"/"left"), the id edges in files predating custom per-side
// counts already reference. That used to be a permanently separate, immovable concept, which caused
// two real bugs: an evenly spaced custom layout can't include a point that is not free to move, and
// the clockwise/transfer math didn't know the fixed point existed. It is now only a synthesis for
// sides never explicitly touched. Once a side's count changes (or a point is added or removed), its
// full point set, the synthesized entry included, is written back and behaves like any point:
// movable, reorderable, removable (down to one per side).
export function effectivePointsForSide(
  storedPoints: ConnectionPoint[],
  side: ConnectionPointSide
): ConnectionPoint[] {
  const onSide = storedPoints.filter((p) => p.side === side)
  return onSide.length > 0 ? onSide : [{ id: side, side, offset: 0.5 }]
}

// Whole-node version for rendering — every side represented, synthesized
// or not.
export function effectiveConnectionPoints(storedPoints: ConnectionPoint[]): ConnectionPoint[] {
  return SIDES.flatMap((side) => effectivePointsForSide(storedPoints, side))
}

// A plain {left, top, width, height} is all the point math actually needs — a real DOMRect
// satisfies this too, and a node's absolute canvas position builds one without a DOM measurement.
export interface RectLike {
  left: number
  top: number
  width: number
  height: number
}

// A point's own absolute {x, y} on the node's current rect — shared by
// nearestConnectionPointWithCoordinates, by the multi-connection-line
// "same ordinal" resolvers, and by the SVG export, which all need to turn a
// resolved ConnectionPoint into real coordinates once they know which point they want.
export function pointCoordinates(rect: RectLike, point: ConnectionPoint): { x: number; y: number } {
  switch (point.side) {
    case 'top':
      return { x: rect.left + rect.width * point.offset, y: rect.top }
    case 'bottom':
      return { x: rect.left + rect.width * point.offset, y: rect.top + rect.height }
    case 'left':
      return { x: rect.left, y: rect.top + rect.height * point.offset }
    case 'right':
      return { x: rect.left + rect.width, y: rect.top + rect.height * point.offset }
  }
}

// Clockwise-around-the-box order per side, used by the count-based
// generator and by remove-with-transfer below — see ADR 0036. Offset
// is defined left-to-right on top/bottom and top-to-bottom on left/right
// (nearestConnectionPoint above), so walking top -> right -> bottom -> left
// clockwise means ascending offset on top/right but descending on
// bottom/left.
export const CLOCKWISE_ASCENDING: Record<ConnectionPointSide, boolean> = {
  top: true,
  right: true,
  bottom: false,
  left: false
}

export function sortClockwise(
  points: ConnectionPoint[],
  side: ConnectionPointSide
): ConnectionPoint[] {
  const ascending = CLOCKWISE_ASCENDING[side]
  return [...points].sort((a, b) => (ascending ? a.offset - b.offset : b.offset - a.offset))
}

// N points, evenly spaced and inset from both corners — N=1 lands at 0.5.
// Applies uniformly to every point on a side now, the point that happens
// to have kept its side-name id included — there's no longer a separate,
// fixed "default" offset to work around.
export function evenOffsets(count: number): number[] {
  return Array.from({ length: count }, (_, i) => (i + 1) / (count + 1))
}

// The one spacing step every structural connection-point operation shares (bulk count change,
// manual add, manual remove): `points` must already be in the desired clockwise order, and every
// point in it, ids preserved, slides onto the evenly spaced offset for its position.
//
// evenOffsets() returns ascending raw offsets, but ascending means clockwise only on top/right
// (CLOCKWISE_ASCENDING); on bottom/left clockwise is descending. Zipping the ascending array
// straight onto a clockwise-sorted points array mirrored the whole side on bottom/left (correct
// order, visually flipped), so the offsets are reversed on those two sides. That keeps "index 0"
// meaning "clockwise-first" on every side.
export function respaceClockwise(
  points: ConnectionPoint[],
  side: ConnectionPointSide
): ConnectionPoint[] {
  const offsets = evenOffsets(points.length)
  const orderedOffsets = CLOCKWISE_ASCENDING[side] ? offsets : [...offsets].reverse()
  return points.map((p, i) => ({ ...p, offset: orderedOffsets[i] }))
}
