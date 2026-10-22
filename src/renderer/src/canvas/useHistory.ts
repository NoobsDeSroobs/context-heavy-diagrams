import { useCallback, useRef, useState } from 'react'
import type { Edge, Node } from '@xyflow/react'
import type { CanvasApi } from './canvasApi'

// Undo/redo — see ADR 0018. Deliberately just {nodes, edges}, not
// viewport: panning/zooming isn't a content edit worth undoing.
interface HistorySnapshot {
  nodes: Node[]
  edges: Edge[]
}
const MAX_HISTORY = 50

// Undo/redo history (ADR 0018): explicit pushSnapshot calls at each mutation site, not an effect
// reacting to nodes/edges changes. The effect version broke under React StrictMode's dev
// double-invoke: its only output was a ref mutation (lastSettledRef), and an effect whose side
// effect isn't safe to run twice is what StrictMode catches. StrictMode doesn't double-invoke
// event-handler callbacks.
export function useHistory({
  graphRef,
  setNodes,
  setEdges,
  markDirty
}: Pick<CanvasApi, 'graphRef' | 'setNodes' | 'setEdges' | 'markDirty'>): {
  past: HistorySnapshot[]
  future: HistorySnapshot[]
  setPast: React.Dispatch<React.SetStateAction<HistorySnapshot[]>>
  setFuture: React.Dispatch<React.SetStateAction<HistorySnapshot[]>>
  pushSnapshot: () => void
  beginContinuousEdit: () => void
  endContinuousEdit: () => void
  undo: () => void
  redo: () => void
} {
  const [past, setPast] = useState<HistorySnapshot[]>([])
  const [future, setFuture] = useState<HistorySnapshot[]>([])
  // Mid-drag/resize/rotate: don't split one continuous gesture into many
  // undo steps. Only beginContinuousEdit/endContinuousEdit touch this —
  // once from the onNodesChange wrapper in Canvas (position/dimension changes
  // carry their own dragging/resizing flag), once from TextNode's rotation
  // handler (no such flag there — it's just repeated updateNodeData calls).
  const interactionInProgressRef = useRef(false)

  const pushSnapshot = useCallback(() => {
    setPast((prev) => {
      const next = [...prev, { ...graphRef.current }]
      return next.length > MAX_HISTORY ? next.slice(next.length - MAX_HISTORY) : next
    })
    setFuture([])
    markDirty()
  }, [graphRef, markDirty])

  // Push once at the start of a continuous gesture (guarded so a mid-drag
  // call is a no-op, not a fresh snapshot), never at the end.
  const beginContinuousEdit = useCallback(() => {
    if (!interactionInProgressRef.current) {
      pushSnapshot()
      interactionInProgressRef.current = true
    }
  }, [pushSnapshot])

  const endContinuousEdit = useCallback(() => {
    interactionInProgressRef.current = false
  }, [])

  const undo = useCallback(() => {
    if (past.length === 0) return
    const previous = past[past.length - 1]
    setFuture((prev) => [...prev, { ...graphRef.current }])
    setPast((prev) => prev.slice(0, -1))
    setNodes(previous.nodes)
    setEdges(previous.edges)
  }, [past, graphRef, setNodes, setEdges])

  const redo = useCallback(() => {
    if (future.length === 0) return
    const next = future[future.length - 1]
    setPast((prev) => [...prev, { ...graphRef.current }])
    setFuture((prev) => prev.slice(0, -1))
    setNodes(next.nodes)
    setEdges(next.edges)
  }, [future, graphRef, setNodes, setEdges])

  return {
    past,
    future,
    setPast,
    setFuture,
    pushSnapshot,
    beginContinuousEdit,
    endContinuousEdit,
    undo,
    redo
  }
}
