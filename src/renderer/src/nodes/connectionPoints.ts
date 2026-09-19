import { showAlert } from '../alerts'
import { useCallback, type MouseEvent } from 'react'
import { type Edge, Position, useReactFlow, useUpdateNodeInternals } from '@xyflow/react'
import type { ConnectionPoint, ConnectionPointSide } from '@shared/diagram'
import { useDiagramContext } from '../useDiagramContext'
import type { ContextMenuItem } from '../components/ContextMenu'

// Shared between ShapeNode and ContainerNode — both are connectable,
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

// Every side always has at least one point. A side with no entries at all
// in the node's own stored `connectionPoints` implicitly has exactly one,
// centered (offset 0.5), using the side's own name as a fixed, stable id
// ("top"/"right"/"bottom"/"left") — the same id every file predating
// custom per-side counts already references from its edges, since that's
// what this app exposed as its 4 always-present, unmovable default
// handles back then. That was originally kept as a real, permanently separate, immovable
// concept — the user found two real bugs traced to exactly that split (an
// evenly-spaced *custom* layout can never truly include a point that
// isn't free to move, and the app's own clockwise/transfer math didn't
// know the fixed point was there at all) — so this is now purely a
// *synthesis* used where a side has never been explicitly touched. Once a
// side's point count changes (or a point is added/removed on it), its
// full point set — this synthesized entry included — is written back for
// real, and it behaves exactly like an ordinary point from then on:
// movable, reorderable, removable (down to a minimum of one per side).
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

// Nearest *existing, connectable* point (a real point, not just a side +
// ideal offset) to an arbitrary point in the same coordinate space as
// `rect`, plus that point's own absolute {x, y} in that same space — used
// by the multi-connection-line feature for both the live drag visual
// (nearest point facing the current pointer, needs real coordinates to
// draw a line to) and the actual edges created on drop (nearest point
// facing the real target node's center, needs just the id). Single
// resolver for both so they can never disagree about which point counts as
// "nearest" — nearestConnectionPoint alone only resolves a side and an
// ideal offset along it; this picks whichever of that side's real points
// (synthesized default or customized) sits closest to that ideal offset.
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
  switch (side) {
    case 'top':
      return { point, x: rect.left + rect.width * point.offset, y: rect.top }
    case 'bottom':
      return { point, x: rect.left + rect.width * point.offset, y: rect.top + rect.height }
    case 'left':
      return { point, x: rect.left, y: rect.top + rect.height * point.offset }
    case 'right':
      return { point, x: rect.left + rect.width, y: rect.top + rect.height * point.offset }
  }
}

// Just the id — the common case (multi-connection onConnect only needs to
// know *which* handle to attach to, not where it sits on screen).
export function nearestConnectionPointId(
  storedPoints: ConnectionPoint[],
  rect: RectLike,
  pointX: number,
  pointY: number
): string {
  return nearestConnectionPointWithCoordinates(storedPoints, rect, pointX, pointY).point.id
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

// The one spacing step every structural connection-point operation shares
// — bulk count-field regenerate, manual add, manual remove alike:
// `points` must already be in the desired clockwise order (whatever was
// inserted/removed already reflected), and every point in it — ids
// preserved — gets slid onto the evenly-spaced offset matching its
// position in that order.
//
// evenOffsets() always returns ascending raw-offset values, but "ascending
// raw offset" only means "clockwise" on top/right (CLOCKWISE_ASCENDING) —
// on bottom/left, clockwise means *descending* raw offset. Handing the
// ascending offsets array straight to a clockwise-sorted points array
// silently mirrored the whole side on bottom/left (the clockwise-first
// point got the smallest raw offset instead of the largest), which is
// what the user caught: correct order but visually flipped. Reversing the
// offsets on those two sides before zipping them onto the points keeps
// "index 0 in the points array" meaning "clockwise-first" for every side.
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

// The count-per-side generator (ADR 0036). `targetTotalCount` is the side's
// whole point count, exactly what the property panel shows and lets the
// user edit — no more default/custom split to convert between. Starts
// from the side's *effective* points (synthesizing its implicit single
// centered point first, if it's never been touched) so growing a
// never-touched side still keeps working from something real. Growing
// keeps every existing point (same id, so its edges stay attached) and
// appends new empty ones at the clockwise end; shrinking removes
// clockwise-most points one at a time, each transferring its edges to the
// new clockwise-most survivor — never below 1 survivor. Either way the
// final set is re-spaced evenly. Only the touched side is written back in
// full; every other side's raw stored data (including any of its own
// still-implicit points) is passed through untouched.
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

// Manual right-click removal. Transfers the removed point's edges to the
// counter-clockwise neighbor ("the point behind it"), except removing the
// clockwise-first point transfers forward to what becomes the new first
// point instead — then, like the bulk generator above, re-spaces every
// surviving point on that side evenly. (An earlier version deliberately
// left survivors' positions untouched, on the theory that manual removal
// should stay hands-off of everything but the one point being removed —
// the user found that "broken" in practice: a side's remaining points
// should always look evenly spread after a removal, the same as after any
// other count change.) Refuses (returns undefined) when this would leave
// the side with zero points — every side must always have at least one.
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

// Manual right-click "add point here". The click position picks a side and
// a rough offset (nearestConnectionPoint) — that's only precise enough to
// determine *where in clockwise order* the new point belongs (between
// which two existing points), not its exact final offset: like the
// removal above, the whole side is re-spaced evenly afterward, with the
// new point taking whichever ordinal slot its click position sorted into.
// (An earlier version placed the new point at the raw click offset and
// left every other point untouched — same "broken" report as removal:
// wedging a point in without re-spacing looked uneven rather than
// deliberately placed.) Existing points keep their ids (and edges), just
// slide to their new evenly-spaced offset. Refuses (returns undefined)
// once the side is already at `maxCount` — the property panel's count
// field enforces the same limit via its own `max` prop, but this path
// bypasses that field entirely, so it needs its own check.
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

  // Right-click on any point (including one that's still only implicit —
  // point identity is resolved through the same effective-points view
  // removeCustomPointWithTransfer itself uses) removes it, distinct from
  // the node-wide menu (which adds one) — stopPropagation so the two
  // don't both fire for the same click. ADR 0036 replaced the original
  // block-if-edge-attached guard with edge transfer — removing a wired
  // point no longer requires disconnecting it first; the only remaining
  // refusal is removing a side's last point.
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
