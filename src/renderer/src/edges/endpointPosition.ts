import type { Node } from '@xyflow/react'
import type { ConnectionPoint, ConnectionPointSide } from '@shared/diagram'
import { effectiveConnectionPoints } from '../nodes/connectionPoints'
import type { PathPoint } from '@shared/geometry/bendablePath'
import { absolutePosition } from '../nodes/nodePosition'

// Outward from a bound endpoint's own side — matches LabeledEdge.tsx's own
// identically-named table one-for-one (small local copy, not shared —
// that file's own comment on OUTWARD_DIRECTION explains why), keyed here
// by this schema's ConnectionPointSide strings instead of React Flow's
// Position enum, since this is only ever used against the app's own
// connectionPoints data, not React Flow's resolved edge props.
const SIDE_OUTWARD_DIRECTION: Record<ConnectionPointSide, { x: number; y: number }> = {
  top: { x: 0, y: -1 },
  right: { x: 1, y: 0 },
  bottom: { x: 0, y: 1 },
  left: { x: -1, y: 0 }
}

// An edge endpoint's resolved absolute position and outward direction —
// used only by "Add point here" below to find the nearest segment on the
// same curve the edge actually renders with (ADR 0057). React Flow
// resolves this internally for rendering, but doesn't expose it as a
// plain computable function, so it's derived directly from the same
// side+offset data ConnectionHandles itself renders from
// (connectionPoints.ts).
export function resolveEndpointPosition(
  nodeId: string,
  handleId: string | null | undefined,
  nodeById: Map<string, Node>
): PathPoint {
  const node = nodeById.get(nodeId)
  if (!node) return { x: 0, y: 0 }
  const abs = absolutePosition(node, nodeById)
  const width = node.width ?? 0
  const height = node.height ?? 0
  const customPoints = (node.data?.connectionPoints as ConnectionPoint[] | undefined) ?? []
  const point = handleId
    ? effectiveConnectionPoints(customPoints).find((p) => p.id === handleId)
    : undefined
  const side = point?.side ?? 'left'
  const offset = point?.offset ?? 0.5
  const direction = SIDE_OUTWARD_DIRECTION[side]
  switch (side) {
    case 'top':
      return { x: abs.x + offset * width, y: abs.y, direction }
    case 'bottom':
      return { x: abs.x + offset * width, y: abs.y + height, direction }
    case 'right':
      return { x: abs.x + width, y: abs.y + offset * height, direction }
    case 'left':
    default:
      return { x: abs.x, y: abs.y + offset * height, direction }
  }
}
