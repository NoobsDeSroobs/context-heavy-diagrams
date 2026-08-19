import { memo, useCallback, type MouseEvent } from 'react'
import { Handle, NodeResizer, Position, useReactFlow, type NodeProps } from '@xyflow/react'
import type { ConnectionPoint, ConnectionPointSide, IconRef, IconSlot } from '@shared/diagram'
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

const SIDE_POSITION: Record<ConnectionPointSide, Position> = {
  top: Position.Top,
  right: Position.Right,
  bottom: Position.Bottom,
  left: Position.Left
}

// Percentage, not pixels, so a point survives resize without recomputing —
// see epic 0013. The 4 default points need no override at all (React
// Flow's own Position.* already centers them), so this only ever applies
// to custom points.
function connectionPointStyle(side: ConnectionPointSide, offset: number): React.CSSProperties {
  const pct = `${offset * 100}%`
  return side === 'top' || side === 'bottom' ? { left: pct } : { top: pct }
}

let nextConnectionPointId = 1

// Right-click position -> nearest side + offset along it, both relative to
// the shape's own current on-screen rect. Simple nearest-edge distance
// comparison, not anything fancier.
function nearestConnectionPoint(
  rect: DOMRect,
  clientX: number,
  clientY: number
): { side: ConnectionPointSide; offset: number } {
  const localX = clientX - rect.left
  const localY = clientY - rect.top
  const distances: [ConnectionPointSide, number][] = [
    ['top', localY],
    ['bottom', rect.height - localY],
    ['left', localX],
    ['right', rect.width - localX]
  ]
  const [side] = distances.reduce((closest, candidate) =>
    candidate[1] < closest[1] ? candidate : closest
  )
  const raw = side === 'top' || side === 'bottom' ? localX / rect.width : localY / rect.height
  return { side, offset: Math.min(1, Math.max(0, raw)) }
}

// Resizable, connectable, never rotated — see docs/decisions/0004-shape-text-node-split.md
// for why rotation is deliberately excluded here (it's what TextNode is for).
//
// Icon slots deliberately render at the true corners with no special
// handling to dodge NodeResizer's corner handles — same stacking order the
// shape's own body already has under them, per user direction on epic 0007.
// The icon *picker* and details panel are NOT rendered here — see
// DiagramContext for why.
function ShapeNode({ id, data, selected }: NodeProps): React.JSX.Element {
  const {
    diagramPath,
    openContextMenu,
    openIconPicker,
    openDetailsPanel,
    handleLinkClick,
    pushSnapshot
  } = useDiagramContext()
  const { updateNodeData, getEdges } = useReactFlow()

  const icons = (data?.icons ?? {}) as Partial<Record<IconSlot, IconRef>>
  const detailsPath = typeof data?.details === 'string' ? data.details : undefined
  const linkedPath = typeof data?.linkedDiagram === 'string' ? data.linkedDiagram : undefined
  const customPoints = (data?.connectionPoints ?? []) as ConnectionPoint[]
  const tooltip = useDetailsTooltip(diagramPath, detailsPath)

  const onContextMenu = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      event.preventDefault()
      const rect = event.currentTarget.getBoundingClientRect()
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
      openContextMenu(event.clientX, event.clientY, [
        { label: 'Add icon', onSelect: () => openIconPicker(id, rect) },
        { label: 'See details', onSelect: () => openDetailsPanel(id) },
        ...linkItems,
        {
          label: 'Add connection point here',
          onSelect: () => {
            pushSnapshot()
            const point = nearestConnectionPoint(rect, event.clientX, event.clientY)
            updateNodeData(id, {
              connectionPoints: [
                ...customPoints,
                { id: `cp-${nextConnectionPointId++}`, ...point }
              ]
            })
          }
        }
      ])
    },
    [
      id,
      openContextMenu,
      openIconPicker,
      openDetailsPanel,
      linkedPath,
      handleLinkClick,
      updateNodeData,
      customPoints,
      pushSnapshot
    ]
  )

  // Right-click on an existing custom point removes it, distinct from the
  // shape-wide menu above (which adds one) — stopPropagation so the two
  // don't both fire for the same click. Default points aren't in
  // customPoints at all, so there's nothing to attach this to for them —
  // they're simply not removable, per epic 0013.
  const onPointContextMenu = useCallback(
    (event: MouseEvent<HTMLDivElement>, point: ConnectionPoint) => {
      event.preventDefault()
      event.stopPropagation()
      openContextMenu(event.clientX, event.clientY, [
        {
          label: 'Remove connection point',
          onSelect: () => {
            const hasEdge = getEdges().some(
              (edge) =>
                (edge.source === id && edge.sourceHandle === point.id) ||
                (edge.target === id && edge.targetHandle === point.id)
            )
            if (hasEdge) {
              alert('This connection point has an edge attached — disconnect it first.')
              return
            }
            pushSnapshot()
            updateNodeData(id, {
              connectionPoints: customPoints.filter((p) => p.id !== point.id)
            })
          }
        }
      ])
    },
    [id, customPoints, getEdges, openContextMenu, updateNodeData, pushSnapshot]
  )

  // Ctrl/Cmd+click is distinct from plain click (selection, handled by React
  // Flow itself) and right-click (context menu, above) — see epic 0009.
  // multiSelectionKeyCode is pinned to Shift in Canvas.tsx so this doesn't
  // collide with React Flow's own default Ctrl/Cmd multi-select toggle.
  const onClick = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      if (!(event.ctrlKey || event.metaKey)) return
      handleLinkClick(id, event.clientX, event.clientY)
    },
    [id, handleLinkClick]
  )

  return (
    <div className="shape-node" onContextMenu={onContextMenu} onClick={onClick} title={tooltip}>
      <NodeResizer isVisible={selected} minWidth={SHAPE_MIN_WIDTH} minHeight={SHAPE_MIN_HEIGHT} />
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
        onCommit={(label) => {
          pushSnapshot()
          updateNodeData(id, { label })
        }}
      />
    </div>
  )
}

export default memo(ShapeNode)
