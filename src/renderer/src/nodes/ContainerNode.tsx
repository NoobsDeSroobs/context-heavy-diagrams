import { memo, useCallback, type MouseEvent } from 'react'
import { NodeResizer, useReactFlow, type NodeProps } from '@xyflow/react'
import type { ConnectionPoint, NodeStyle } from '@shared/diagram'
import EditableLabel from '../components/EditableLabel'
import { useDiagramContext } from '../DiagramContext'
import { nodeContainerCss, nodeLabelCss } from '../styles/nodeStyleCss'
import { ConnectionHandles } from './ConnectionHandles'
import { useConnectionPointMenu } from './connectionPoints'

export const CONTAINER_MIN_WIDTH = 160
export const CONTAINER_MIN_HEIGHT = 120

// Resizable, connectable, never rotated — same structural category as
// ShapeNode, deliberately, not TextNode. See ADR 0012 for why (a container
// plausibly needs edges attached to it directly, e.g. an external system
// connecting to a "VPC" as a whole — rotating a connectable node reopens
// the edge-misattachment bug ADR 0004 already solved once).
//
// A transparent body (not a filled shape) so contained nodes stay visible
// through it — those are separate sibling elements in React Flow's render
// tree, not DOM children of this div, so they aren't affected by anything
// this component does with pointer events or z-order.
function ContainerNode({ id, data, selected }: NodeProps): React.JSX.Element {
  const { pushSnapshot, openContextMenu, openColorPicker, attachContainedNodes } = useDiagramContext()
  const { updateNodeData } = useReactFlow()
  const customPoints = (data?.connectionPoints ?? []) as ConnectionPoint[]
  const style = data?.style as NodeStyle | undefined
  const { addConnectionPointItem, onPointContextMenu } = useConnectionPointMenu(id, customPoints)

  const onContextMenu = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      event.preventDefault()
      const rect = event.currentTarget.getBoundingClientRect()
      openContextMenu(event.clientX, event.clientY, [
        { label: 'Fill…', onSelect: () => openColorPicker(id, 'fill', rect) },
        { label: 'Border…', onSelect: () => openColorPicker(id, 'border', rect) },
        { label: 'Attach contained shapes', onSelect: () => attachContainedNodes(id) },
        addConnectionPointItem(rect, event.clientX, event.clientY)
      ])
    },
    [openContextMenu, openColorPicker, addConnectionPointItem, attachContainedNodes, id]
  )

  return (
    <div className="container-node" style={nodeContainerCss(style)} onContextMenu={onContextMenu}>
      <NodeResizer
        isVisible={selected}
        minWidth={CONTAINER_MIN_WIDTH}
        minHeight={CONTAINER_MIN_HEIGHT}
      />
      <ConnectionHandles customPoints={customPoints} onPointContextMenu={onPointContextMenu} />
      <EditableLabel
        className="container-node-label"
        inputClassName="container-node-label-input"
        style={nodeLabelCss(style)}
        value={String(data?.label ?? '')}
        onCommit={(label) => {
          pushSnapshot()
          updateNodeData(id, { label })
        }}
      />
    </div>
  )
}

export default memo(ContainerNode)
