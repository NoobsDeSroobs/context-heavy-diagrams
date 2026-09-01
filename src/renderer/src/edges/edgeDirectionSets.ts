import type { Edge, Node } from '@xyflow/react'
import type {
  ConnectionPoint,
  EdgeDirection,
  EdgeDirectionSet,
  EdgeStyle,
  LineStyleKind,
  LinePoint,
  MarkerKind
} from '@shared/diagram'
import { effectiveConnectionPoints } from '../nodes/connectionPoints'

// Seed / fallback colour for a direction set's legend swatch — same value
// as LegendPanel's own DEFAULT_COLOR so a fresh set's row looks like a
// fresh authored 'line' entry.
export const DEFAULT_DIRECTION_SET_LEGEND_COLOR = '#e6194b'

// The legend row the active direction set contributes (ADR 0081): its name
// drawn as an arrow, shown in the Legend panel and prepended to the PNG
// export legend. `null` when the diagram has no direction set.
export interface DirectionSetLegendRow {
  label: string
  color: string
  lineStyle?: LineStyleKind
  startMarker?: MarkerKind
  endMarker?: MarkerKind
}

export function directionSetLegendRow(
  sets: EdgeDirectionSet[],
  activeId: string | undefined
): DirectionSetLegendRow | null {
  const active = sets.find((s) => s.id === activeId) ?? sets[0]
  if (!active) return null
  return {
    label: active.name,
    color: active.legend?.color ?? DEFAULT_DIRECTION_SET_LEGEND_COLOR,
    lineStyle: active.legend?.lineStyle,
    startMarker: active.legend?.startMarker,
    endMarker: active.legend?.endMarker
  }
}

// Flippable edge direction — see ADR 0081. A diagram can carry several
// named "readings" of its edges (DiagramFile.edgeDirectionSets) that differ
// only in arrow direction. Every edge exists in every set; the per-set
// orientation lives in `edge.data.directionSets` keyed by set id.
//
// The live React Flow fields (edge.source/target/sourceHandle/targetHandle)
// always render the *active* set. `edge.data.directionSets` is refreshed
// from those live fields only when it's about to be read — at a set switch
// and at save — so no direction-editing handler has to keep it in sync.

// React Flow's Edge.data is an untyped bag; this app stashes these fields
// on it (same casts as Canvas.tsx does everywhere).
function edgePoints(edge: Edge): LinePoint[] {
  return Array.isArray(edge.data?.points) ? (edge.data.points as LinePoint[]) : []
}
function edgeStyle(edge: Edge): EdgeStyle | undefined {
  return edge.data?.style as EdgeStyle | undefined
}
function edgeDirectionRecords(edge: Edge): Record<string, EdgeDirection> {
  const d = edge.data?.directionSets
  return d && typeof d === 'object' ? (d as Record<string, EdgeDirection>) : {}
}

export function edgeLiveDirection(edge: Edge): EdgeDirection {
  return {
    source: edge.source,
    target: edge.target,
    sourceHandle: edge.sourceHandle ?? undefined,
    targetHandle: edge.targetHandle ?? undefined
  }
}

// The direction-only involution shared by "Reverse direction" (the
// per-edge context-menu action) and a set switch that flips an edge: the
// endpoints swap, so the direction-sensitive *visuals* must travel with
// their physical end — catmull-rom `points` reverse (the curve is walked
// [source, ...points, target]), start/end markers swap, and a custom
// `labelPosition` (a ratio measured from source) mirrors. 0.5 / absent
// values are unaffected, so this is a no-op for the common untouched case.
// A true involution: applying it twice restores the original.
export function flipEdgeVisuals(edge: Edge): { points: LinePoint[]; style: EdgeStyle | undefined } {
  const points = edgePoints(edge)
  const style = edgeStyle(edge)
  return {
    points: points.length > 0 ? [...points].reverse() : points,
    style: style && {
      ...style,
      startMarker: style.endMarker,
      endMarker: style.startMarker,
      labelPosition: style.labelPosition !== undefined ? 1 - style.labelPosition : undefined
    }
  }
}

function nodeHandleIds(node: Node | undefined): Set<string> {
  if (!node) return new Set()
  const stored = Array.isArray(node.data?.connectionPoints)
    ? (node.data.connectionPoints as ConnectionPoint[])
    : []
  return new Set(effectiveConnectionPoints(stored).map((p) => p.id))
}

// Lazy repair of a stored EdgeDirection whose handle id no longer resolves
// to a real connection point on its node (the point was deleted or the
// side's count was reduced while a different set was active). A missing
// handle falls back to `undefined` — the same "let the renderer pick a
// reasonable point" meaning an absent handle already carries in the schema
// — rather than guessing a geometric nearest, which isn't recoverable once
// the original point is gone.
export function repairDirection(
  dir: EdgeDirection,
  sourceNode: Node | undefined,
  targetNode: Node | undefined
): EdgeDirection {
  const sourceIds = nodeHandleIds(sourceNode)
  const targetIds = nodeHandleIds(targetNode)
  return {
    source: dir.source,
    target: dir.target,
    sourceHandle:
      dir.sourceHandle && sourceIds.has(dir.sourceHandle) ? dir.sourceHandle : undefined,
    targetHandle: dir.targetHandle && targetIds.has(dir.targetHandle) ? dir.targetHandle : undefined
  }
}

function withDirectionRecords(edge: Edge, records: Record<string, EdgeDirection>): Edge {
  return { ...edge, data: { ...edge.data, directionSets: records } }
}

// Write `dir` into an edge's live fields, flipping the shared visuals if
// the orientation differs from what the edge currently shows.
export function applyDirectionToEdge(edge: Edge, dir: EdgeDirection): Edge {
  const flips = dir.source !== edge.source
  const data: Record<string, unknown> = { ...edge.data }
  if (flips) {
    const flipped = flipEdgeVisuals(edge)
    data.points = flipped.points
    data.style = flipped.style
  }
  return {
    ...edge,
    source: dir.source,
    target: dir.target,
    sourceHandle: dir.sourceHandle,
    targetHandle: dir.targetHandle,
    data
  }
}

// Fill any missing per-set entry from the edge's current live direction, so
// an edge created since the last switch/save (via onConnect, multi-connection
// wiring, paste) is seeded for every set without those paths knowing about
// direction sets. No-op below 2 sets.
export function ensureDirectionSets(edges: Edge[], setIds: string[]): Edge[] {
  if (setIds.length < 2) return edges
  return edges.map((edge) => {
    const existing = edgeDirectionRecords(edge)
    const missing = setIds.filter((id) => !existing[id])
    if (missing.length === 0) return edge
    const live = edgeLiveDirection(edge)
    const next = { ...existing }
    for (const id of missing) next[id] = { ...live }
    return withDirectionRecords(edge, next)
  })
}

// Capture edits made while `activeId` was active back into its per-set
// record (and seed any new edges). Run immediately before `directionSets`
// is read — at a switch and at save.
export function refreshActiveDirectionSet(
  edges: Edge[],
  setIds: string[],
  activeId: string
): Edge[] {
  if (setIds.length < 2) return edges
  return ensureDirectionSets(edges, setIds).map((edge) =>
    withDirectionRecords(edge, {
      ...edgeDirectionRecords(edge),
      [activeId]: edgeLiveDirection(edge)
    })
  )
}

// Drop every per-set record — used when the diagram falls back to a single
// direction set (dormant). The edge's live fields stay as they are.
export function stripDirectionSets(edges: Edge[]): Edge[] {
  return edges.map((edge) => {
    if (!edge.data || !('directionSets' in edge.data)) return edge
    const next: Record<string, unknown> = { ...edge.data }
    delete next.directionSets
    return { ...edge, data: next }
  })
}

// Drop one set's key from every edge's records — used when deleting a set
// while two or more remain.
export function removeDirectionSetKey(edges: Edge[], setId: string): Edge[] {
  return edges.map((edge) => {
    const existing = edgeDirectionRecords(edge)
    if (!(setId in existing)) return edge
    const next = { ...existing }
    delete next[setId]
    return withDirectionRecords(edge, next)
  })
}

// Add a new set `newId` to every edge, its record copied from `fromId`
// (falling back to the edge's live direction). `setIds` is the *resulting*
// set-id list, so any still-missing records get seeded first.
export function addDirectionSetFrom(
  edges: Edge[],
  setIds: string[],
  newId: string,
  fromId: string
): Edge[] {
  return ensureDirectionSets(edges, setIds).map((edge) => {
    const existing = edgeDirectionRecords(edge)
    const from = existing[fromId] ?? edgeLiveDirection(edge)
    return withDirectionRecords(edge, { ...existing, [newId]: { ...from } })
  })
}

// Switch the displayed reading from `fromId` to `toId`: refresh the
// outgoing set, then re-point every edge's live fields at the incoming
// set's (repaired) record. `nodesById` resolves stale handles.
export function switchActiveDirectionSet(
  edges: Edge[],
  setIds: string[],
  fromId: string,
  toId: string,
  nodesById: Map<string, Node>
): Edge[] {
  if (fromId === toId || setIds.length < 2) return edges
  return refreshActiveDirectionSet(edges, setIds, fromId).map((edge) => {
    const stored = edgeDirectionRecords(edge)[toId]
    if (!stored) return edge
    const repaired = repairDirection(
      stored,
      nodesById.get(stored.source),
      nodesById.get(stored.target)
    )
    return applyDirectionToEdge(edge, repaired)
  })
}
