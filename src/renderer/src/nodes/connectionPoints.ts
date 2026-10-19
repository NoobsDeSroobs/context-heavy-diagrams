import { showAlert } from '../alerts'
import { useCallback, type MouseEvent } from 'react'
import { type Edge, Position, useReactFlow, useUpdateNodeInternals } from '@xyflow/react'
import type { ConnectionPoint, ConnectionPointSide } from '@shared/diagram'
import { useDiagramContext } from '../useDiagramContext'
import type { ContextMenuItem } from '../components/ContextMenu'

// Shared between EntityNode and ContainerNode — both are connectable,
// non-rotatable node types with the same connection point model (see ADR
// 0012 for why containers are connectable at all).

export const SIDE_POSITION: Record<ConnectionPointSide, Position> = {
  top: Position.Top,
  right: Position.Right,
  bottom: Position.Bottom,
  left: Position.Left
}

const SIDES: ConnectionPointSide[] = ['top', 'right', 'bottom', 'left']

// Percentage, not pixels, so a point survives resize without recomputing.
export function connectionPointStyle(
  side: ConnectionPointSide,
  offset: number
): React.CSSProperties {
  const pct = `${offset * 100}%`
  return side === 'top' || side === 'bottom' ? { left: pct } : { top: pct }
}

let nextConnectionPointId = 1

// Every side always has at least one point. A side with nothing in the node's stored
// `connectionPoints` implicitly has exactly one, centred (offset 0.5), with the side's own name as
// a stable id ("top"/"right"/"bottom"/"left"), the id edges in files predating custom per-side
// counts already reference. That used to be a permanently separate, immovable concept, which caused
// two real bugs: an evenly spaced custom layout can't include a point that is not free to move, and
// the clockwise/transfer math didn't know the fixed point existed. It is now only a synthesis for
// sides never explicitly touched. Once a side's count changes (or a point is added or removed), its
// full point set, the synthesized entry included, is written back and behaves like any point:
// movable, reorderable, removable (down to one per side).
function effectivePointsForSide(
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

// The property panel's count field, and anything else that just needs "how
// many points does this side have right now" without needing the points
// themselves.
export function connectionPointCountForSide(
  storedPoints: ConnectionPoint[],
  side: ConnectionPointSide
): number {
  return effectivePointsForSide(storedPoints, side).length
}

// A plain {left, top, width, height} is all nearestConnectionPoint actually
// needs — a real DOMRect satisfies this too, so widening from DOMRect to
// this narrower shape doesn't break any existing caller, and lets
// nearestConnectionPointId below build one straight from a node's absolute
// canvas position without needing a real DOM measurement.
export interface RectLike {
  left: number
  top: number
  width: number
  height: number
}

// Right-click position -> nearest side + offset along it, both relative to
// the node's own current on-screen rect. Simple nearest-edge distance
// comparison, not anything fancier.
export function nearestConnectionPoint(
  rect: RectLike,
  clientX: number,
  clientY: number
): { side: ConnectionPointSide; offset: number } {
  const localX = clientX - rect.left
  const localY = clientY - rect.top
  const distances: [ConnectionPointSide, number][] = [
    ['top', localY],
    ['bottom', rect.height - localY],
    ['left', localX],
    ['right', rect.width - localX]
  ]
  const [side] = distances.reduce((closest, candidate) =>
    candidate[1] < closest[1] ? candidate : closest
  )
  const raw = side === 'top' || side === 'bottom' ? localX / rect.width : localY / rect.height
  return { side, offset: Math.min(1, Math.max(0, raw)) }
}

// A point's own absolute {x, y} on the node's current rect — shared by
// nearestConnectionPointWithCoordinates below and by the multi-connection-line
// "same ordinal" resolvers, which both need to turn a resolved ConnectionPoint
// into real screen coordinates once they already know which point they want.
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

// Nearest *existing, connectable* point (a real point, not just a side +
// ideal offset) to an arbitrary point in the same coordinate space as
// `rect`, plus that point's own absolute {x, y} in that same space — used
// by right-click "add connection point here"'s side/offset resolution.
// nearestConnectionPoint alone only resolves a side and an ideal offset
// along it; this picks whichever of that side's real points (synthesized
// default or customized) sits closest to that ideal offset.
export function nearestConnectionPointWithCoordinates(
  storedPoints: ConnectionPoint[],
  rect: RectLike,
  pointX: number,
  pointY: number
): { point: ConnectionPoint; x: number; y: number } {
  const { side, offset } = nearestConnectionPoint(rect, pointX, pointY)
  const onSide = effectivePointsForSide(storedPoints, side)
  const point = onSide.reduce((best, candidate) =>
    Math.abs(candidate.offset - offset) < Math.abs(best.offset - offset) ? candidate : best
  )
  return { point, ...pointCoordinates(rect, point) }
}

// A point's clockwise position on its own side (1-based) plus how many
// points that side has — multi-connection-line's starting point: resolve
// the dragged-from handle to "3rd of 5 on top" once, then replicate that
// ordinal onto every other selected entity via connectionPointAtOrdinal
// below, rather than each entity picking its own nearest point independently
// (see ADR 0059's addendum — nearest-to-target looked inconsistent in real
// use, since unrelated entities rarely face the target the same way).
export function pointOrdinal(
  storedPoints: ConnectionPoint[],
  pointId: string
): { side: ConnectionPointSide; ordinal: number; total: number } | undefined {
  const effective = effectiveConnectionPoints(storedPoints)
  const point = effective.find((p) => p.id === pointId)
  if (!point) return undefined
  const onSide = sortClockwise(
    effective.filter((p) => p.side === point.side),
    point.side
  )
  return {
    side: point.side,
    ordinal: onSide.findIndex((p) => p.id === pointId) + 1,
    total: onSide.length
  }
}

// The point at the same clockwise ordinal on a given side — clamped to
// however many points that side actually has, so ordinal 3 on a side with
// only 2 falls back to point 2 (the closest available), and 1 on a
// single-point side. Always returns a real point since every side has at
// least one.
export function connectionPointAtOrdinal(
  storedPoints: ConnectionPoint[],
  side: ConnectionPointSide,
  ordinal: number
): ConnectionPoint {
  const onSide = sortClockwise(effectivePointsForSide(storedPoints, side), side)
  return onSide[Math.min(ordinal, onSide.length) - 1]
}

// Clockwise-around-the-box order per side, used by the count-based
// generator and by remove-with-transfer below — see ADR 0036. Offset
// is defined left-to-right on top/bottom and top-to-bottom on left/right
// (nearestConnectionPoint above), so walking top -> right -> bottom -> left
// clockwise means ascending offset on top/right but descending on
// bottom/left.
const CLOCKWISE_ASCENDING: Record<ConnectionPointSide, boolean> = {
  top: true,
  right: true,
  bottom: false,
  left: false
}

function sortClockwise(points: ConnectionPoint[], side: ConnectionPointSide): ConnectionPoint[] {
  const ascending = CLOCKWISE_ASCENDING[side]
  return [...points].sort((a, b) => (ascending ? a.offset - b.offset : b.offset - a.offset))
}

// N points, evenly spaced and inset from both corners — N=1 lands at 0.5.
// Applies uniformly to every point on a side now, the point that happens
// to have kept its side-name id included — there's no longer a separate,
// fixed "default" offset to work around.
function evenOffsets(count: number): number[] {
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
function respaceClockwise(points: ConnectionPoint[], side: ConnectionPointSide): ConnectionPoint[] {
  const offsets = evenOffsets(points.length)
  const orderedOffsets = CLOCKWISE_ASCENDING[side] ? offsets : [...offsets].reverse()
  return points.map((p, i) => ({ ...p, offset: orderedOffsets[i] }))
}

// Rewrites this node's edges off any removed/renumbered handle id onto its
// replacement — shared by the single right-click remove and the bulk
// count-based regenerate below, both of which produce a removed-id ->
// surviving-id map rather than touching edges directly.
export function reassignConnectionPointHandles(
  edges: Edge[],
  nodeId: string,
  reassignments: Map<string, string>
): Edge[] {
  if (reassignments.size === 0) return edges
  return edges.map((edge) => {
    let next = edge
    if (edge.source === nodeId && edge.sourceHandle && reassignments.has(edge.sourceHandle)) {
      next = { ...next, sourceHandle: reassignments.get(edge.sourceHandle) }
    }
    if (edge.target === nodeId && edge.targetHandle && reassignments.has(edge.targetHandle)) {
      next = { ...next, targetHandle: reassignments.get(edge.targetHandle) }
    }
    return next
  })
}

// The count-per-side generator (ADR 0036). `targetTotalCount` is the side's whole point count,
// exactly what the property panel shows and edits. It starts from the side's effective points
// (synthesizing the implicit centred point first if the side was never touched). Growing keeps
// every existing point (same id, so its edges stay attached) and appends new empty ones at the
// clockwise end; shrinking removes the clockwise-most points one at a time, each handing its edges
// to the new clockwise-most survivor, never below one. Either way the final set is re-spaced
// evenly. Only the touched side is written back in full; every other side's raw stored data,
// including its still-implicit points, passes through untouched.
export function setSideCustomPointCount(
  storedPoints: ConnectionPoint[],
  side: ConnectionPointSide,
  targetTotalCount: number
): { points: ConnectionPoint[]; handleReassignments: Map<string, string> } {
  const otherSides = storedPoints.filter((p) => p.side !== side)
  const target = Math.max(1, targetTotalCount)
  let survivors = sortClockwise(effectivePointsForSide(storedPoints, side), side)
  const handleReassignments = new Map<string, string>()

  while (survivors.length > target) {
    const lastIndex = survivors.length - 1
    const removed = survivors[lastIndex]
    const transferTarget = survivors[lastIndex - 1].id
    handleReassignments.set(removed.id, transferTarget)
    survivors = survivors.slice(0, lastIndex)
  }

  for (let i = survivors.length; i < target; i++) {
    survivors.push({ id: `cp-${nextConnectionPointId++}`, side, offset: 0 })
  }

  return { points: [...otherSides, ...respaceClockwise(survivors, side)], handleReassignments }
}

// Manual right-click removal. The removed point's edges transfer to the counter-clockwise neighbour
// ("the point behind it"); removing the clockwise-first point transfers forward to the new first
// point. Like the bulk generator, it then re-spaces every surviving point on that side evenly:
// leaving survivors where they were looked broken, since a side's remaining points should look
// evenly spread after any count change. Refuses (returns undefined) when that would leave the side
// with zero points.
export function removeCustomPointWithTransfer(
  storedPoints: ConnectionPoint[],
  pointId: string
): { points: ConnectionPoint[]; transferTargetHandleId: string } | undefined {
  const effective = effectiveConnectionPoints(storedPoints)
  const point = effective.find((p) => p.id === pointId)
  if (!point) return undefined
  const onSide = sortClockwise(
    effective.filter((p) => p.side === point.side),
    point.side
  )
  if (onSide.length <= 1) return undefined
  const index = onSide.findIndex((p) => p.id === pointId)
  const transferTargetHandleId = (onSide[index - 1] ?? onSide[index + 1]).id
  const otherSides = storedPoints.filter((p) => p.side !== point.side)
  const survivors = onSide.filter((p) => p.id !== pointId)
  return {
    points: [...otherSides, ...respaceClockwise(survivors, point.side)],
    transferTargetHandleId
  }
}

// Manual right-click "add point here". The click position (nearestConnectionPoint) only decides
// where in the clockwise order the new point belongs, between which two existing points, not its
// final offset: as with removal, the whole side is re-spaced evenly afterwards and the new point
// takes the ordinal slot it sorted into. Placing it at the raw click offset and leaving the others
// alone looked uneven rather than deliberate. Existing points keep their ids (and edges) and just
// slide to their new offsets. Refuses (returns undefined) once the side is at `maxCount`: the
// property panel's count field enforces the same limit through its own `max` prop, but this path
// bypasses that field.
export function insertConnectionPointAt(
  storedPoints: ConnectionPoint[],
  side: ConnectionPointSide,
  clickOffset: number,
  maxCount: number
): ConnectionPoint[] | undefined {
  const onSide = sortClockwise(effectivePointsForSide(storedPoints, side), side)
  if (onSide.length >= maxCount) return undefined
  const otherSides = storedPoints.filter((p) => p.side !== side)
  const ascending = CLOCKWISE_ASCENDING[side]
  let insertIndex = onSide.length
  for (let i = 0; i < onSide.length; i++) {
    const clickIsBeforeExisting = ascending
      ? clickOffset < onSide[i].offset
      : clickOffset > onSide[i].offset
    if (clickIsBeforeExisting) {
      insertIndex = i
      break
    }
  }
  const newPoint: ConnectionPoint = {
    id: `cp-${nextConnectionPointId++}`,
    side,
    offset: clickOffset
  }
  const withInserted = [...onSide.slice(0, insertIndex), newPoint, ...onSide.slice(insertIndex)]
  return [...otherSides, ...respaceClockwise(withInserted, side)]
}

// Add-point context menu item + remove-point handler, sharing the same
// pushSnapshot/updateNodeData logic regardless of which connectable node
// type owns the point.
export function useConnectionPointMenu(
  id: string,
  customPoints: ConnectionPoint[]
): {
  addConnectionPointItem: (rect: DOMRect, clientX: number, clientY: number) => ContextMenuItem
  onPointContextMenu: (event: MouseEvent<HTMLDivElement>, point: ConnectionPoint) => void
} {
  const { pushSnapshot, openContextMenu, maxConnectionPointsPerSide } = useDiagramContext()
  const { updateNodeData, setEdges } = useReactFlow()
  const updateNodeInternals = useUpdateNodeInternals()

  const addConnectionPointItem = useCallback(
    (rect: DOMRect, clientX: number, clientY: number): ContextMenuItem => ({
      label: 'Add connection point here',
      onSelect: () => {
        const { side, offset } = nearestConnectionPoint(rect, clientX, clientY)
        const points = insertConnectionPointAt(
          customPoints,
          side,
          offset,
          maxConnectionPointsPerSide
        )
        if (!points) {
          showAlert(
            `This side already has the maximum of ${maxConnectionPointsPerSide} connection points.`
          )
          return
        }
        pushSnapshot()
        updateNodeData(id, { connectionPoints: points })
        // React Flow caches each node's handle bounds for connection
        // validation at mount time — a handle added afterwards renders fine
        // but silently refuses connections until this runs. Existing
        // points on the side can also have slid to a new offset (the
        // re-space), so this covers them too, not just the new one.
        updateNodeInternals(id)
      }
    }),
    [
      id,
      customPoints,
      maxConnectionPointsPerSide,
      pushSnapshot,
      updateNodeData,
      updateNodeInternals
    ]
  )

  // Right-click on any point, including one that is still only implicit (identity is resolved
  // through the same effective-points view removeCustomPointWithTransfer uses), removes it,
  // distinct from the node-wide menu that adds one; stopPropagation keeps the two from both firing
  // for one click. ADR 0036 replaced the block-if-edge-attached guard with edge transfer, so
  // removing a wired point needs no prior disconnect; the only refusal left is a side's last point.
  const onPointContextMenu = useCallback(
    (event: MouseEvent<HTMLDivElement>, point: ConnectionPoint) => {
      event.preventDefault()
      event.stopPropagation()
      openContextMenu(event.clientX, event.clientY, [
        {
          label: 'Remove connection point',
          onSelect: () => {
            const result = removeCustomPointWithTransfer(customPoints, point.id)
            if (!result) {
              showAlert("Can't remove the last connection point on this side.")
              return
            }
            pushSnapshot()
            updateNodeData(id, { connectionPoints: result.points })
            setEdges((eds) =>
              reassignConnectionPointHandles(
                eds,
                id,
                new Map([[point.id, result.transferTargetHandleId]])
              )
            )
            updateNodeInternals(id)
          }
        }
      ])
    },
    [id, customPoints, openContextMenu, updateNodeData, setEdges, pushSnapshot, updateNodeInternals]
  )

  return { addConnectionPointItem, onPointContextMenu }
}
