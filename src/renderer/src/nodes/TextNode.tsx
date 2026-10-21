import { memo, useCallback, useRef, useState } from 'react'
import { NodeResizer, useReactFlow, type NodeProps } from '@xyflow/react'
import type { NodeStyle } from '@shared/diagram'
import EditableLabel from '../components/EditableLabel'
import LockBadge from '../tagging/LockBadge'
import { useDiagramContext } from '../useDiagramContext'
import { isolateStyle } from '../search/search'
import { nodeContainerCss, nodeLabelCss } from '../styles/nodeStyleCss'

export const TEXT_MIN_WIDTH = 40
export const TEXT_MIN_HEIGHT = 24

// Resizable, rotatable, never connectable — see docs/decisions/0004-shape-text-node-split.md.
// Rotation has no native React Flow slot, so it's stored in data.rotation.
//
// Known v1 limitation: NodeResizer's drag math doesn't account for this
// node's own rotation, so resizing an already-rotated node can feel
// slightly off. Accepted for now — see ADR 0004's Alternatives.
function TextNode({ id, data, selected }: NodeProps): React.JSX.Element {
  const { updateNodeData, getNode } = useReactFlow()
  const {
    openContextMenu,
    openDetailsPanel,
    detachFromParent,
    handleLinkClick,
    beginContinuousEdit,
    endContinuousEdit,
    pushSnapshot,
    theme,
    entityHighlightNodeId,
    searchMatchIds,
    isolateActive,
    isolateOpacity,
    selectAllOfType,
    groupResize
  } = useDiagramContext()
  const rotation = typeof data?.rotation === 'number' ? (data.rotation as number) : 0
  const locked = data?.locked === true
  const nodeRef = useRef<HTMLDivElement>(null)
  const [rotating, setRotating] = useState(false)
  const linkedPath = typeof data?.linkedDiagram === 'string' ? data.linkedDiagram : undefined
  const style = data?.style as NodeStyle | undefined

  const onContextMenu = useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault()
      const linkItems = linkedPath
        ? [
            {
              label: 'Open linked diagram',
              onSelect: () => handleLinkClick(id, event.clientX, event.clientY)
            },
            {
              label: 'Remove link',
              onSelect: () => {
                pushSnapshot()
                updateNodeData(id, { linkedDiagram: undefined })
              }
            }
          ]
        : [
            {
              label: 'Link to diagram…',
              onSelect: () => handleLinkClick(id, event.clientX, event.clientY)
            }
          ]
      const detachItem = getNode(id)?.parentId
        ? [{ label: 'Detach from parent', onSelect: () => detachFromParent(id) }]
        : []
      openContextMenu(event.clientX, event.clientY, [
        { label: 'See details', onSelect: () => openDetailsPanel(id) },
        ...linkItems,
        ...detachItem,
        { label: 'Select all text', separatorBefore: true, onSelect: () => selectAllOfType('text') }
      ])
    },
    [
      id,
      openContextMenu,
      openDetailsPanel,
      detachFromParent,
      getNode,
      linkedPath,
      handleLinkClick,
      updateNodeData,
      pushSnapshot,
      selectAllOfType
    ]
  )

  // Ctrl/Cmd+click is distinct from plain click (selection) and right-click
  // (context menu, above) — it navigates a linked diagram. multiSelectionKeyCode is pinned
  // to Shift in Canvas.tsx so this doesn't collide with React Flow's own
  // default Ctrl/Cmd multi-select toggle.
  const onClick = useCallback(
    (event: React.MouseEvent) => {
      if (!(event.ctrlKey || event.metaKey)) return
      handleLinkClick(id, event.clientX, event.clientY)
    },
    [id, handleLinkClick]
  )

  const onRotateStart = useCallback(
    (event: React.MouseEvent) => {
      event.stopPropagation()
      const nodeEl = nodeRef.current
      if (!nodeEl) return
      setRotating(true)
      // Rotation has no dragging/resizing flag the way position/dimension
      // changes do (it's just repeated updateNodeData calls in the
      // mousemove loop below), so the undo history (ADR 0018) needs an
      // explicit start/end marker to group the whole drag into one step
      // instead of one step per mousemove tick.
      beginContinuousEdit()

      const rect = nodeEl.getBoundingClientRect()
      const center = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }

      const onMouseMove = (moveEvent: MouseEvent): void => {
        const angle =
          (Math.atan2(moveEvent.clientY - center.y, moveEvent.clientX - center.x) * 180) / Math.PI +
          90
        updateNodeData(id, { rotation: Math.round(angle) })
      }
      const onMouseUp = (): void => {
        setRotating(false)
        endContinuousEdit()
        window.removeEventListener('mousemove', onMouseMove)
        window.removeEventListener('mouseup', onMouseUp)
      }
      window.addEventListener('mousemove', onMouseMove)
      window.addEventListener('mouseup', onMouseUp)
    },
    [id, updateNodeData, beginContinuousEdit, endContinuousEdit]
  )

  return (
    <div
      ref={nodeRef}
      className={`text-node${rotating ? ' rotating' : ''}${entityHighlightNodeId === id ? ' entity-highlighted' : ''}${searchMatchIds.has(id) ? ' search-match' : ''}`}
      style={{
        transform: `rotate(${rotation}deg)`,
        ...nodeContainerCss(style, theme),
        ...isolateStyle(id, isolateActive, searchMatchIds, isolateOpacity)
      }}
      onContextMenu={onContextMenu}
      onClick={onClick}
    >
      <NodeResizer
        isVisible={selected && !locked}
        minWidth={TEXT_MIN_WIDTH}
        minHeight={TEXT_MIN_HEIGHT}
        onResizeStart={() => groupResize.start(id)}
        onResize={(_, params) => groupResize.resize(id, params)}
        onResizeEnd={groupResize.end}
      />
      {selected && !locked && (
        <div
          className="text-node-rotate-handle nodrag nopan"
          onMouseDown={onRotateStart}
          title="Drag to rotate"
        />
      )}
      {locked && <LockBadge />}
      <EditableLabel
        className="text-node-label"
        inputClassName="text-node-label-input"
        multiline
        style={nodeLabelCss(style, theme)}
        value={String(data?.label ?? '')}
        onCommit={(label) => {
          pushSnapshot()
          updateNodeData(id, { label })
        }}
      />
    </div>
  )
}

export default memo(TextNode)
