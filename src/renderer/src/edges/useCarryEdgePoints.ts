import { useCallback, useLayoutEffect, useMemo, useRef } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import type { Edge, Node } from '@xyflow/react'
import {
  absoluteBoxes,
  edgeShift,
  nearestEnds,
  nodeShifts,
  shiftNearestEnds,
  shiftPoints,
  type End
} from '@shared/edges/carryPoints'
import type { LinePoint } from '@shared/diagram'

export interface CarryEdgePoints {
  // A mouse drag is starting. With `nearestEnd` (Ctrl/Cmd held), points of an edge whose ends move
  // differently follow the end they are nearest to, decided now and kept until `endDrag`.
  beginDrag: (nearestEnd: boolean) => void
  endDrag: () => void
}

// Moving elements carries the manual points of an edge whose two ends move by the same amount
// (ADR 0189). It watches the nodes rather than the gestures, so a drag, a container drag, a nudge,
// the alignment panel and a typed position all count. A render that changes the edges too (undo,
// redo, opening a file, pasting) is not a move, and its points are left as they were saved.
export function useCarryEdgePoints(
  nodes: Node[],
  edges: Edge[],
  setEdges: Dispatch<SetStateAction<Edge[]>>
): CarryEdgePoints {
  const previous = useRef({ nodes, edges })
  const nearest = useRef<Map<string, (End | null)[]> | null>(null)

  useLayoutEffect(() => {
    const was = previous.current
    previous.current = { nodes, edges }
    if (was.nodes === nodes || was.edges !== edges) return
    if (!edges.some((e) => hasPoints(e))) return
    const shifts = nodeShifts(was.nodes, nodes)
    if (shifts.size === 0) return
    let changed = false
    const next = edges.map((edge) => {
      if (!hasPoints(edge)) return edge
      const by = edgeShift(shifts, edge.source, edge.target)
      if (by) {
        changed = true
        return { ...edge, data: { ...edge.data, points: shiftPoints(pointsOf(edge), by) } }
      }
      const ends = nearest.current?.get(edge.id)
      const points = pointsOf(edge)
      if (!ends || ends.length !== points.length) return edge
      const moved = shiftNearestEnds(points, ends, {
        source: shifts.get(edge.source),
        target: shifts.get(edge.target)
      })
      if (moved.every((p, i) => p === points[i])) return edge
      changed = true
      return { ...edge, data: { ...edge.data, points: moved } }
    })
    // The edges are replaced here, so the next run of this effect must see them as its own.
    if (changed) setEdges(next)
  }, [nodes, edges, setEdges])

  const beginDrag = useCallback((nearestEnd: boolean): void => {
    if (!nearestEnd) {
      nearest.current = null
      return
    }
    const { nodes: ns, edges: es } = previous.current
    const boxes = absoluteBoxes(ns)
    const tied = new Map<string, (End | null)[]>()
    for (const edge of es) {
      const source = boxes.get(edge.source)
      const target = boxes.get(edge.target)
      if (!hasPoints(edge) || !source || !target) continue
      tied.set(edge.id, nearestEnds(pointsOf(edge), source, target))
    }
    nearest.current = tied
  }, [])
  const endDrag = useCallback((): void => {
    nearest.current = null
  }, [])
  return useMemo(() => ({ beginDrag, endDrag }), [beginDrag, endDrag])
}

const pointsOf = (edge: Edge): LinePoint[] => (edge.data?.points as LinePoint[] | undefined) ?? []
const hasPoints = (edge: Edge): boolean => pointsOf(edge).length > 0
