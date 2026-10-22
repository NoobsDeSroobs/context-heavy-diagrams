import { useCallback, useState } from 'react'
import type { Edge, Node } from '@xyflow/react'
import type { CanvasApi } from '../canvas/canvasApi'
import { useEventCallback } from '../canvas/useEventCallback'
import {
  applyBrushToEdgeData,
  applyBrushToNodeData,
  brushAppliesToNode,
  captureEdgeBrush,
  captureNodeBrush,
  type StyleBrush
} from './styleBrush'

export interface StyleBrushState {
  styleBrush: StyleBrush | null
  setStyleBrush: React.Dispatch<React.SetStateAction<StyleBrush | null>>
  toggleStyleBrush: () => void
  pasteStyleToSelection: () => void
  onStyleBrushNodeClick: (event: React.MouseEvent, node: Node) => void
  onStyleBrushEdgeClick: (event: React.MouseEvent, edge: Edge) => void
}

// Copy style / "format painter" (ADR 0095). The brush is a snapshot of the
// source's stored style taken on entry, not a live reference to the
// selection — clicking a target changes the selection. Session-only.
// Everything here reads the latest state through useEventCallback and the
// React Flow instance, so none of it churns the DiagramContext value.
export function useStyleBrush({
  rfInstance,
  setNodes,
  setEdges,
  pushSnapshot
}: CanvasApi): StyleBrushState {
  const [styleBrush, setStyleBrush] = useState<StyleBrush | null>(null)

  const toggleStyleBrush = useEventCallback(() => {
    if (styleBrush) {
      setStyleBrush(null)
      return
    }
    const selNodes = rfInstance.getNodes().filter((n) => n.selected)
    const selEdges = rfInstance.getEdges().filter((e) => e.selected)
    if (selNodes.length + selEdges.length !== 1) return
    const brush =
      selNodes.length === 1 ? captureNodeBrush(selNodes[0]) : captureEdgeBrush(selEdges[0])
    if (brush) setStyleBrush(brush)
  })

  // Applies the brush to whichever of the given elements accept it (same
  // type only; a mismatch is silently skipped). One undo step for the batch.
  const applyStyleBrush = useEventCallback((nodeIds: string[], edgeIds: string[]) => {
    if (!styleBrush) return
    const nodeTargets = new Set(
      rfInstance
        .getNodes()
        .filter((n) => nodeIds.includes(n.id) && brushAppliesToNode(styleBrush, n))
        .map((n) => n.id)
    )
    const edgeTargets = new Set(styleBrush.kind === 'edge' ? edgeIds : [])
    if (nodeTargets.size + edgeTargets.size === 0) return
    pushSnapshot()
    if (nodeTargets.size > 0) {
      setNodes((nds) =>
        nds.map((n) =>
          nodeTargets.has(n.id) ? { ...n, data: applyBrushToNodeData(styleBrush, n.data) } : n
        )
      )
    }
    if (edgeTargets.size > 0) {
      setEdges((eds) =>
        eds.map((e) =>
          edgeTargets.has(e.id) ? { ...e, data: applyBrushToEdgeData(styleBrush, e.data) } : e
        )
      )
    }
  })

  const pasteStyleToSelection = useEventCallback(() => {
    applyStyleBrush(
      rfInstance
        .getNodes()
        .filter((n) => n.selected)
        .map((n) => n.id),
      rfInstance
        .getEdges()
        .filter((e) => e.selected)
        .map((e) => e.id)
    )
  })

  // Plain clicks only — Ctrl/Cmd+click follows a link and Shift+click edits
  // the selection, neither should also paint.
  const onStyleBrushNodeClick = useCallback(
    (event: React.MouseEvent, node: Node) => {
      if (event.ctrlKey || event.metaKey || event.shiftKey) return
      applyStyleBrush([node.id], [])
    },
    [applyStyleBrush]
  )
  const onStyleBrushEdgeClick = useCallback(
    (event: React.MouseEvent, edge: Edge) => {
      if (event.ctrlKey || event.metaKey || event.shiftKey) return
      applyStyleBrush([], [edge.id])
    },
    [applyStyleBrush]
  )

  return {
    styleBrush,
    setStyleBrush,
    toggleStyleBrush,
    pasteStyleToSelection,
    onStyleBrushNodeClick,
    onStyleBrushEdgeClick
  }
}
