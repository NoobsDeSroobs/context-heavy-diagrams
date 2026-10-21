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
