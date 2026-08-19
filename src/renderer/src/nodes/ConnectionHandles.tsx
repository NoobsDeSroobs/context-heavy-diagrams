import type { MouseEvent } from 'react'
import { Handle, Position } from '@xyflow/react'
import type { ConnectionPoint } from '@shared/diagram'
import { SIDE_POSITION, connectionPointStyle } from './connectionPoints'

// The 4 always-present default points plus whatever custom ones exist —
// shared between ShapeNode and ContainerNode. Split into its own file (kept
// out of connectionPoints.ts) so that file stays component-free — mixing a
// component export with hook/function exports in one file breaks React
// Fast Refresh.
export function ConnectionHandles({
  customPoints,
  onPointContextMenu
}: {
  customPoints: ConnectionPoint[]
  onPointContextMenu: (event: MouseEvent<HTMLDivElement>, point: ConnectionPoint) => void
}): React.JSX.Element {
  return (
    <>
      <Handle type="source" position={Position.Top} id="top" />
      <Handle type="source" position={Position.Right} id="right" />
      <Handle type="source" position={Position.Bottom} id="bottom" />
      <Handle type="source" position={Position.Left} id="left" />
      {customPoints.map((point) => (
        <Handle
          key={point.id}
          type="source"
          position={SIDE_POSITION[point.side]}
          id={point.id}
          style={connectionPointStyle(point.side, point.offset)}
          onContextMenu={(event) => onPointContextMenu(event, point)}
        />
      ))}
    </>
  )
}
