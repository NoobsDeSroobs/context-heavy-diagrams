import { useLayoutEffect, useRef } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import type { Edge, Node } from '@xyflow/react'
import { edgeShift, nodeShifts, shiftPoints } from '@shared/edges/carryPoints'
import type { LinePoint } from '@shared/diagram'

// Moving elements carries the manual points of an edge whose two ends move by the same amount
// (ADR 0189). It watches the nodes rather than the gestures, so a drag, a container drag, a nudge,
// the alignment panel and a typed position all count. A render that changes the edges too (undo,
// redo, opening a file, pasting) is not a move, and its points are left as they were saved.
export function useCarryEdgePoints(
  nodes: Node[],
  edges: Edge[],
  setEdges: Dispatch<SetStateAction<Edge[]>>
): void {
  const previous = useRef({ nodes, edges })
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
      if (!by) return edge
      changed = true
      return { ...edge, data: { ...edge.data, points: shiftPoints(pointsOf(edge), by) } }
    })
    // The edges are replaced here, so the next run of this effect must see them as its own.
    if (changed) setEdges(next)
  }, [nodes, edges, setEdges])
}

const pointsOf = (edge: Edge): LinePoint[] => (edge.data?.points as LinePoint[] | undefined) ?? []
const hasPoints = (edge: Edge): boolean => pointsOf(edge).length > 0
