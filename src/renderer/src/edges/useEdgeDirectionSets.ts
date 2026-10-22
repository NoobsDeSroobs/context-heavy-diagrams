import { useCallback, useState } from 'react'
import type { Edge } from '@xyflow/react'
import type { EdgeDirectionSet, EdgeDirectionSetStyle } from '@shared/diagram'
import type { CanvasApi } from '../canvas/canvasApi'
import type { useHistory } from '../canvas/useHistory'
import {
  addDirectionSetFrom,
  DEFAULT_DIRECTION_SET_LEGEND_COLOR,
  removeDirectionSetKey,
  stripDirectionSets,
  switchActiveDirectionSet
} from './edgeDirectionSets'

export interface EdgeDirectionSetsState {
  edgeDirectionSets: EdgeDirectionSet[]
  setEdgeDirectionSets: React.Dispatch<React.SetStateAction<EdgeDirectionSet[]>>
  activeEdgeDirectionSetId: string | undefined
  setActiveEdgeDirectionSetId: React.Dispatch<React.SetStateAction<string | undefined>>
  switchEdgeDirectionSet: (toId: string) => void
  addEdgeDirectionSet: (copyFromId?: string) => void
  renameEdgeDirectionSet: (id: string, name: string) => void
  updateEdgeDirectionSetStyle: (id: string, patch: Partial<EdgeDirectionSetStyle>) => void
  deleteEdgeDirectionSet: (id: string) => void
}

type History = ReturnType<typeof useHistory>

export function useEdgeDirectionSets(
  { graphRef, setEdges, markDirty }: CanvasApi,
  { setPast, setFuture }: Pick<History, 'setPast' | 'setFuture'>
): EdgeDirectionSetsState {
  // Flippable edge direction sets (ADR 0081) — same file-scoped/reset-on-
  // load treatment as gravityPresets. `[]` (or a single set) means
  // the feature is dormant: an edge's direction is just its own
  // source/target/handles. When >= 2 sets exist, [0] is the "base" set the
  // edges are stored in on disk, and `activeEdgeDirectionSetId` picks which
  // reading the live edges currently show.
  const [edgeDirectionSets, setEdgeDirectionSets] = useState<EdgeDirectionSet[]>([])
  const [activeEdgeDirectionSetId, setActiveEdgeDirectionSetId] = useState<string | undefined>(
    undefined
  )

  // A switch re-orients the live edges AND every history snapshot's edges
  // (so a later undo doesn't restore a stale orientation); it is not itself
  // an undo step. Set create/duplicate/delete/rename likewise just mutate
  // state and mark the diagram dirty, no snapshot.
  const rewriteHistoryEdges = useCallback(
    (transform: (edges: Edge[]) => Edge[]) => {
      setPast((p) => p.map((s) => ({ ...s, edges: transform(s.edges) })))
      setFuture((f) => f.map((s) => ({ ...s, edges: transform(s.edges) })))
    },
    [setPast, setFuture]
  )

  const switchEdgeDirectionSet = useCallback(
    (toId: string) => {
      const fromId = activeEdgeDirectionSetId ?? edgeDirectionSets[0]?.id
      const setIds = edgeDirectionSets.map((s) => s.id)
      if (!fromId || fromId === toId || !setIds.includes(toId)) return
      const nodesById = new Map(graphRef.current.nodes.map((n) => [n.id, n]))
      const transform = (eds: Edge[]): Edge[] =>
        switchActiveDirectionSet(eds, setIds, fromId, toId, nodesById)
      setEdges(transform)
      rewriteHistoryEdges(transform)
      setActiveEdgeDirectionSetId(toId)
      markDirty()
    },
    [
      activeEdgeDirectionSetId,
      edgeDirectionSets,
      graphRef,
      setEdges,
      rewriteHistoryEdges,
      markDirty
    ]
  )

  const addEdgeDirectionSet = useCallback(
    (copyFromId?: string) => {
      const existing = edgeDirectionSets
      const source = copyFromId ? existing.find((s) => s.id === copyFromId) : undefined
      const used = new Set(existing.map((s) => s.name))
      let name: string
      if (existing.length === 0) {
        name = 'Data flow'
      } else if (source) {
        name = `${source.name} copy`
        for (let n = 2; used.has(name); n++) name = `${source.name} copy ${n}`
      } else {
        name = 'Trigger direction'
        for (let n = 2; used.has(name); n++) name = `Direction ${n}`
      }
      const newSet: EdgeDirectionSet = {
        id: `dirset-${crypto.randomUUID()}`,
        name,
        // ADR 0083: `style` is the reading's default edge style — seeds new
        // edges + drives the legend row. A fresh set gets a plain arrow.
        style: source?.style
          ? { ...source.style }
          : { stroke: DEFAULT_DIRECTION_SET_LEGEND_COLOR, endMarker: 'arrowClosed' }
      }
      const next = [...existing, newSet]
      // Per-edge records only exist at 2+ sets — seed the new set (and
      // materialise the base set's records) only once we cross that line.
      if (next.length >= 2) {
        const setIds = next.map((s) => s.id)
        const fromId = copyFromId ?? activeEdgeDirectionSetId ?? next[0].id
        const transform = (eds: Edge[]): Edge[] =>
          addDirectionSetFrom(eds, setIds, newSet.id, fromId)
        setEdges(transform)
        rewriteHistoryEdges(transform)
      }
      setEdgeDirectionSets(next)
      if (!activeEdgeDirectionSetId) setActiveEdgeDirectionSetId(next[0].id)
      markDirty()
    },
    [edgeDirectionSets, activeEdgeDirectionSetId, setEdges, rewriteHistoryEdges, markDirty]
  )

  const renameEdgeDirectionSet = useCallback(
    (id: string, name: string) => {
      setEdgeDirectionSets((prev) => prev.map((s) => (s.id === id ? { ...s, name } : s)))
      markDirty()
    },
    [markDirty]
  )

  // The set's default edge style (ADR 0083) — seeds new edges drawn while
  // this reading is active, and drives its legend row. Does not restyle
  // existing edges.
  const updateEdgeDirectionSetStyle = useCallback(
    (id: string, patch: Partial<EdgeDirectionSetStyle>) => {
      setEdgeDirectionSets((prev) =>
        prev.map((s) => (s.id === id ? { ...s, style: { ...s.style, ...patch } } : s))
      )
      markDirty()
    },
    [markDirty]
  )

  const deleteEdgeDirectionSet = useCallback(
    (id: string) => {
      const sets = edgeDirectionSets
      if (!sets.some((s) => s.id === id)) return
      const setIds = sets.map((s) => s.id)
      const fromActive = activeEdgeDirectionSetId ?? sets[0]?.id
      const remaining = sets.filter((s) => s.id !== id)
      const targetActive =
        remaining.length === 0 ? undefined : id === fromActive ? remaining[0].id : fromActive
      // Per-edge records only exist at 2+ sets. Below that there's nothing
      // on the edges to touch — just drop the registry entry.
      if (sets.length >= 2) {
        const nodesById = new Map(graphRef.current.nodes.map((n) => [n.id, n]))
        const transform = (eds: Edge[]): Edge[] => {
          const reoriented =
            targetActive && fromActive && targetActive !== fromActive
              ? switchActiveDirectionSet(eds, setIds, fromActive, targetActive, nodesById)
              : eds
          return remaining.length <= 1
            ? stripDirectionSets(reoriented)
            : removeDirectionSetKey(reoriented, id)
        }
        setEdges(transform)
        rewriteHistoryEdges(transform)
      }
      setEdgeDirectionSets(remaining)
      setActiveEdgeDirectionSetId(targetActive)
      markDirty()
    },
    [
      edgeDirectionSets,
      activeEdgeDirectionSetId,
      graphRef,
      setEdges,
      rewriteHistoryEdges,
      markDirty
    ]
  )

  return {
    edgeDirectionSets,
    setEdgeDirectionSets,
    activeEdgeDirectionSetId,
    setActiveEdgeDirectionSetId,
    switchEdgeDirectionSet,
    addEdgeDirectionSet,
    renameEdgeDirectionSet,
    updateEdgeDirectionSetStyle,
    deleteEdgeDirectionSet
  }
}
