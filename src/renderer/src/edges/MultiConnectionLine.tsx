import { useNodes, type Node } from '@xyflow/react'
import type { ConnectionPoint } from '@shared/diagram'
import { absolutePosition } from '../geometry/nodePosition'
import { nearestConnectionPointWithCoordinates } from '../nodes/connectionPoints'

// Same three types as Canvas.tsx's isConnectableNodeType — kept as its own
// copy (not imported) since importing from Canvas.tsx just for this one
// helper would pull in that whole module's side effects for no reason;
// this is small and stable enough that a duplicate is cheaper than the
// coupling. If it ever drifts out of sync, both call sites are one grep
// for "isConnectableNodeType" away from each other.
function isConnectableNodeType(type: string | undefined): boolean {
  return type === 'shape' || type === 'container' || type === 'anchor'
}

interface MultiConnectionLineProps {
  fromNode?: { id: string } | null
  fromX: number
  fromY: number
  toX: number
  toY: number
  connectionLineStyle?: React.CSSProperties
}

// Live drag-time visual for multi-connection-line (see onConnect's own
// comment in Canvas.tsx for the full feature and why it exists) — draws
// React Flow's own default dashed line (same className, so it inherits the
// same CSS look with no extra styling needed) from the node actually being
// dragged from, plus one more identical line from every *other* selected,
// connectable node to the same cursor position, so the eventual multi-edge
// result is visible before you even release. Providing a custom
// connectionLineComponent replaces React Flow's default rendering
// entirely (see @xyflow/react's own ConnectionLine), so the "from" line
// has to be drawn here too, not just the extra ones.
//
// Each additional node's own line starts from whichever of its connection
// points is nearest the current cursor position (nearestConnectionPoint
// WithCoordinates, connectionPoints.ts) — the exact same resolver
// onConnect uses to decide the real edge's handle once you release, so the
// preview never points somewhere the actual result won't.
export default function MultiConnectionLine({
  fromNode,
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
        const { x, y } = nearestConnectionPointWithCoordinates(
          (n.data?.connectionPoints as ConnectionPoint[] | undefined) ?? [],
          { left: abs.x, top: abs.y, width: n.width ?? 0, height: n.height ?? 0 },
          toX,
          toY
        )
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
