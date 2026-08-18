import { memo, useCallback, useRef, useState } from 'react'
import { NodeResizer, useReactFlow, type NodeProps } from '@xyflow/react'
import EditableLabel from '../components/EditableLabel'

export const TEXT_MIN_WIDTH = 40
export const TEXT_MIN_HEIGHT = 24

// Resizable, rotatable, never connectable — see docs/decisions/0004-shape-text-node-split.md.
// Rotation has no native React Flow slot, so it's stored in data.rotation.
//
// Known v1 limitation: NodeResizer's drag math doesn't account for this
// node's own rotation, so resizing an already-rotated node can feel
// slightly off. Accepted for now — see the epic 0002 notes.
function TextNode({ id, data, selected }: NodeProps): React.JSX.Element {
  const { updateNodeData } = useReactFlow()
  const rotation = typeof data?.rotation === 'number' ? (data.rotation as number) : 0
  const nodeRef = useRef<HTMLDivElement>(null)
  const [rotating, setRotating] = useState(false)

  const onRotateStart = useCallback(
    (event: React.MouseEvent) => {
      event.stopPropagation()
      const nodeEl = nodeRef.current
      if (!nodeEl) return
      setRotating(true)

      const rect = nodeEl.getBoundingClientRect()
      const center = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }

      const onMouseMove = (moveEvent: MouseEvent): void => {
        const angle =
          (Math.atan2(moveEvent.clientY - center.y, moveEvent.clientX - center.x) * 180) /
            Math.PI +
          90
        updateNodeData(id, { rotation: Math.round(angle) })
      }
      const onMouseUp = (): void => {
        setRotating(false)
        window.removeEventListener('mousemove', onMouseMove)
        window.removeEventListener('mouseup', onMouseUp)
      }
      window.addEventListener('mousemove', onMouseMove)
      window.addEventListener('mouseup', onMouseUp)
    },
    [id, updateNodeData]
  )

  return (
    <div
      ref={nodeRef}
      className={`text-node${rotating ? ' rotating' : ''}`}
      style={{ transform: `rotate(${rotation}deg)` }}
    >
      <NodeResizer isVisible={selected} minWidth={TEXT_MIN_WIDTH} minHeight={TEXT_MIN_HEIGHT} />
      {selected && (
        <div
          className="text-node-rotate-handle nodrag nopan"
          onMouseDown={onRotateStart}
          title="Drag to rotate"
        />
      )}
      <EditableLabel
        className="text-node-label"
        inputClassName="text-node-label-input"
        value={String(data?.label ?? '')}
        onCommit={(label) => updateNodeData(id, { label })}
      />
    </div>
  )
}

export default memo(TextNode)
