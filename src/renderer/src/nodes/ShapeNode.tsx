import { memo } from 'react'
import { Handle, NodeResizer, Position, useReactFlow, type NodeProps } from '@xyflow/react'
import EditableLabel from '../components/EditableLabel'

export const SHAPE_MIN_WIDTH = 60
export const SHAPE_MIN_HEIGHT = 40

// Resizable, connectable, never rotated — see docs/decisions/0004-shape-text-node-split.md
// for why rotation is deliberately excluded here (it's what TextNode is for).
function ShapeNode({ id, data, selected }: NodeProps): React.JSX.Element {
  const { updateNodeData } = useReactFlow()

  return (
    <div className="shape-node">
      <NodeResizer isVisible={selected} minWidth={SHAPE_MIN_WIDTH} minHeight={SHAPE_MIN_HEIGHT} />
      <Handle type="source" position={Position.Top} id="top" />
      <Handle type="source" position={Position.Right} id="right" />
      <Handle type="source" position={Position.Bottom} id="bottom" />
      <Handle type="source" position={Position.Left} id="left" />
      <EditableLabel
        className="shape-node-label"
        inputClassName="shape-node-label-input"
        value={String(data?.label ?? '')}
        onCommit={(label) => updateNodeData(id, { label })}
      />
    </div>
  )
}

export default memo(ShapeNode)
