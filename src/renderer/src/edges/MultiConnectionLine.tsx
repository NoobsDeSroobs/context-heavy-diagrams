import { useNodes, type Node } from '@xyflow/react'
import type { ConnectionPoint } from '@shared/diagram'
import { absolutePosition } from '../nodes/nodePosition'
import { connectionPointAtOrdinal, pointCoordinates, pointOrdinal } from '../nodes/connectionPoints'

// Same two types as Canvas.tsx's isConnectableNodeType — kept as its own
// copy (not imported) since importing from Canvas.tsx just for this one
// helper would pull in that whole module's side effects for no reason;
// this is small and stable enough that a duplicate is cheaper than the
// coupling. If it ever drifts out of sync, both call sites are one grep
// for "isConnectableNodeType" away from each other.
function isConnectableNodeType(type: string | undefined): boolean {
  return type === 'entity' || type === 'container'
}

interface MultiConnectionLineProps {
  fromNode?: { id: string } | null
  fromHandle?: { id?: string | null } | null
  fromX: number
  fromY: number
  toX: number
  toY: number
  connectionLineStyle?: React.CSSProperties
}

// Live drag-time visual for multi-connection-line (see onConnect in Canvas.tsx for the feature):
// React Flow's default dashed line (same className, so it inherits the same CSS) from the node
// being dragged from, plus an identical line from every other selected, connectable node to the
// same cursor position, so the eventual multi-edge result is visible before release. A custom
// connectionLineComponent replaces React Flow's default rendering entirely (see @xyflow/react's
// ConnectionLine), so the "from" line must be drawn here too.
//
// Each additional line starts from the same clockwise-ordinal point as the dragged-from one
// (pointOrdinal/connectionPointAtOrdinal, connectionPoints.ts), the same resolver onConnect uses
// for the real edge's handle on release, so the preview never points somewhere the result won't.
// Falls back to the node's first point if the drag's handle can't be resolved yet (mid-drag, before
// React Flow has settled fromHandle), rather than drawing nothing.
export default function MultiConnectionLine({
  fromNode,
  fromHandle,
  fromX,
  fromY,
  toX,
  toY,
  connectionLineStyle
}: MultiConnectionLineProps): React.JSX.Element {
  const nodes = useNodes()
  const byId = new Map(nodes.map((n: Node) => [n.id, n]))
  const others = nodes.filter(
    (n: Node) => n.id !== fromNode?.id && n.selected && isConnectableNodeType(n.type)
  )
  const draggedFrom = fromNode ? byId.get(fromNode.id) : undefined
  const fromOrdinal =
    draggedFrom && fromHandle?.id
      ? pointOrdinal(
          (draggedFrom.data?.connectionPoints as ConnectionPoint[] | undefined) ?? [],
          fromHandle.id
        )
      : undefined
  return (
    <>
      <path
        d={`M${fromX},${fromY} L${toX},${toY}`}
        fill="none"
        className="react-flow__connection-path"
        style={connectionLineStyle}
      />
      {others.map((n: Node) => {
        const abs = absolutePosition(n, byId)
        const rect = { left: abs.x, top: abs.y, width: n.width ?? 0, height: n.height ?? 0 }
        const storedPoints = (n.data?.connectionPoints as ConnectionPoint[] | undefined) ?? []
        const point = fromOrdinal
          ? connectionPointAtOrdinal(storedPoints, fromOrdinal.side, fromOrdinal.ordinal)
          : connectionPointAtOrdinal(storedPoints, 'top', 1)
        const { x, y } = pointCoordinates(rect, point)
        return (
          <path
            key={n.id}
            d={`M${x},${y} L${toX},${toY}`}
            fill="none"
            className="react-flow__connection-path"
            style={connectionLineStyle}
          />
        )
      })}
    </>
  )
}
