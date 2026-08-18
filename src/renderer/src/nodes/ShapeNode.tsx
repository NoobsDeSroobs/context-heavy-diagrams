import { memo, useCallback, type MouseEvent } from 'react'
import { Handle, NodeResizer, Position, useReactFlow, type NodeProps } from '@xyflow/react'
import type { IconRef, IconSlot } from '@shared/diagram'
import EditableLabel from '../components/EditableLabel'
import IconSlotView from '../components/IconSlotView'
import { useDiagramContext } from '../DiagramContext'
import { useDetailsTooltip } from '../hooks/useDetailsTooltip'

export const SHAPE_MIN_WIDTH = 60
export const SHAPE_MIN_HEIGHT = 40

const SLOT_CLASS: Record<IconSlot, string> = {
  topLeft: 'shape-node-icon shape-node-icon-top-left',
  topRight: 'shape-node-icon shape-node-icon-top-right',
  bottomLeft: 'shape-node-icon shape-node-icon-bottom-left',
  bottomRight: 'shape-node-icon shape-node-icon-bottom-right'
}
const SLOTS = Object.keys(SLOT_CLASS) as IconSlot[]

// Resizable, connectable, never rotated — see docs/decisions/0004-shape-text-node-split.md
// for why rotation is deliberately excluded here (it's what TextNode is for).
//
// Icon slots deliberately render at the true corners with no special
// handling to dodge NodeResizer's corner handles — same stacking order the
// shape's own body already has under them, per user direction on epic 0007.
// The icon *picker* and details panel are NOT rendered here — see
// DiagramContext for why.
function ShapeNode({ id, data, selected }: NodeProps): React.JSX.Element {
  const { diagramPath, openContextMenu, openIconPicker, openDetailsPanel } = useDiagramContext()
  const { updateNodeData } = useReactFlow()

  const icons = (data?.icons ?? {}) as Partial<Record<IconSlot, IconRef>>
  const detailsPath = typeof data?.details === 'string' ? data.details : undefined
  const tooltip = useDetailsTooltip(diagramPath, detailsPath)

  const onContextMenu = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      event.preventDefault()
      const rect = event.currentTarget.getBoundingClientRect()
      openContextMenu(event.clientX, event.clientY, [
        { label: 'Add icon', onSelect: () => openIconPicker(id, rect) },
        { label: 'See details', onSelect: () => openDetailsPanel(id) }
      ])
    },
    [id, openContextMenu, openIconPicker, openDetailsPanel]
  )

  return (
    <div className="shape-node" onContextMenu={onContextMenu} title={tooltip}>
      <NodeResizer isVisible={selected} minWidth={SHAPE_MIN_WIDTH} minHeight={SHAPE_MIN_HEIGHT} />
      <Handle type="source" position={Position.Top} id="top" />
      <Handle type="source" position={Position.Right} id="right" />
      <Handle type="source" position={Position.Bottom} id="bottom" />
      <Handle type="source" position={Position.Left} id="left" />
      {SLOTS.map((slot) => (
        <IconSlotView
          key={slot}
          icon={icons[slot]}
          diagramPath={diagramPath}
          className={SLOT_CLASS[slot]}
        />
      ))}
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
