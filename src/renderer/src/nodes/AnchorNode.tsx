import { memo } from 'react'
import { ConnectionHandles } from './ConnectionHandles'

export const ANCHOR_SIZE = 14

// The "leave it dangling" outcome of dragging an edge into empty space
// (see ADR 0015) when the user dismisses the shape-type popup instead of
// picking one — just a small draggable dot, connectable and movable like
// any other node, with no other behavior. Same 4-side handle ids as
// ShapeNode/ContainerNode (via the shared ConnectionHandles) so
// `resolveAnchorNode` can turn one into either without touching the edge's
// targetHandle.
function AnchorNode(): React.JSX.Element {
  return (
    <div className="anchor-node">
      <ConnectionHandles storedPoints={[]} onPointContextMenu={() => {}} />
    </div>
  )
}

export default memo(AnchorNode)
