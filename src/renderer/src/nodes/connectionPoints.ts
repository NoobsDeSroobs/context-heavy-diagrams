import { useCallback, type MouseEvent } from 'react'
import { Position, useReactFlow, useUpdateNodeInternals } from '@xyflow/react'
import type { ConnectionPoint, ConnectionPointSide } from '@shared/diagram'
import { useDiagramContext } from '../DiagramContext'
import type { ContextMenuItem } from '../components/ContextMenu'

// Shared between ShapeNode and ContainerNode — both are connectable,
// non-rotatable node types with the same 4-default-plus-custom connection
// point model (see ADR 0012 for why containers are connectable at all).

export const SIDE_POSITION: Record<ConnectionPointSide, Position> = {
  top: Position.Top,
  right: Position.Right,
  bottom: Position.Bottom,
  left: Position.Left
}

// Percentage, not pixels, so a point survives resize without recomputing —
// see epic 0013. The 4 default points need no override at all (React
// Flow's own Position.* already centers them), so this only ever applies
// to custom points.
export function connectionPointStyle(
  side: ConnectionPointSide,
  offset: number
): React.CSSProperties {
  const pct = `${offset * 100}%`
  return side === 'top' || side === 'bottom' ? { left: pct } : { top: pct }
}

let nextConnectionPointId = 1

// Right-click position -> nearest side + offset along it, both relative to
// the node's own current on-screen rect. Simple nearest-edge distance
// comparison, not anything fancier.
export function nearestConnectionPoint(
  rect: DOMRect,
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

// Add-point context menu item + remove-point handler, sharing the same
// pushSnapshot/updateNodeData/hasEdge-check logic regardless of which
// connectable node type owns the point.
export function useConnectionPointMenu(
  id: string,
  customPoints: ConnectionPoint[]
): {
  addConnectionPointItem: (rect: DOMRect, clientX: number, clientY: number) => ContextMenuItem
  onPointContextMenu: (event: MouseEvent<HTMLDivElement>, point: ConnectionPoint) => void
} {
  const { pushSnapshot, openContextMenu } = useDiagramContext()
  const { updateNodeData, getEdges } = useReactFlow()
  const updateNodeInternals = useUpdateNodeInternals()

  const addConnectionPointItem = useCallback(
    (rect: DOMRect, clientX: number, clientY: number): ContextMenuItem => ({
      label: 'Add connection point here',
      onSelect: () => {
        pushSnapshot()
        const point = nearestConnectionPoint(rect, clientX, clientY)
        updateNodeData(id, {
          connectionPoints: [...customPoints, { id: `cp-${nextConnectionPointId++}`, ...point }]
        })
        // React Flow caches each node's handle bounds for connection
        // validation at mount time — a handle added afterwards renders fine
        // but silently refuses connections until this runs.
        updateNodeInternals(id)
      }
    }),
    [id, customPoints, pushSnapshot, updateNodeData, updateNodeInternals]
  )

  // Right-click on an existing custom point removes it, distinct from the
  // node-wide menu (which adds one) — stopPropagation so the two don't both
  // fire for the same click. Default points aren't in customPoints at all,
  // so there's nothing to attach this to for them — not removable, per
  // epic 0013.
  const onPointContextMenu = useCallback(
    (event: MouseEvent<HTMLDivElement>, point: ConnectionPoint) => {
      event.preventDefault()
      event.stopPropagation()
      openContextMenu(event.clientX, event.clientY, [
        {
          label: 'Remove connection point',
          onSelect: () => {
            const hasEdge = getEdges().some(
              (edge) =>
                (edge.source === id && edge.sourceHandle === point.id) ||
                (edge.target === id && edge.targetHandle === point.id)
            )
            if (hasEdge) {
              alert('This connection point has an edge attached — disconnect it first.')
              return
            }
            pushSnapshot()
            updateNodeData(id, {
              connectionPoints: customPoints.filter((p) => p.id !== point.id)
            })
            updateNodeInternals(id)
          }
        }
      ])
    },
    [id, customPoints, getEdges, openContextMenu, updateNodeData, pushSnapshot, updateNodeInternals]
  )

  return { addConnectionPointItem, onPointContextMenu }
}
