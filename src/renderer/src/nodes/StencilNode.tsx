import {
  memo,
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent,
  type PointerEvent
} from 'react'
import { NodeResizer, useReactFlow, type NodeProps } from '@xyflow/react'
import type { ConnectionPoint, NodeStyle } from '@shared/diagram'
import {
  HEAVY_BORDER_FACTOR,
  MARK_STROKE,
  STENCIL_MARK_PATHS,
  STENCIL_MARK_SOLID,
  stencilDoubleBorder,
  stencilKind,
  stencilLabelInsets,
  stencilLightColors,
  stencilLabelOutside,
  stencilMarkOf,
  stencilMarkScale,
  stencilSolid,
  stencilStyle
} from '@shared/stencils/kinds'
import { labelBox, labelPositionOf, leaderLine, offsetOf } from '@shared/stencils/labelPlacement'
import { NODE_STYLE_DEFAULTS } from '@shared/styling/styleDefaults'
import EditableLabel from '../ui/EditableLabel'
import LockBadge from '../tagging/LockBadge'
import { useDiagramContext } from '../canvas/useDiagramContext'
import { isolateStyle } from '../search/search'
import { withOpacity } from '../styling/colorOpacity'
import { nodeContainerCss, nodeLabelCss } from '../styling/nodeStyleCss'
import { ConnectionHandles } from './ConnectionHandles'
import { useConnectionPointMenu } from './connectionPoints'

// An event or a verb of a flow (ADR 0080): a base shape with an optional mark on it, taken from the
// element's kind. Resizable, connectable, never rotated, no notes, tags or icons of its own, and one
// link to another diagram. The small shapes carry their label below them; a step carries it inside.

function StencilNode({ id, data, selected }: NodeProps): React.JSX.Element {
  const {
    openContextMenu,
    detachFromParent,
    handleLinkClick,
    pushSnapshot,
    theme,
    entityHighlightNodeId,
    searchMatchIds,
    isolateActive,
    isolateOpacity,
    selectAllOfType,
    groupResize,
    pendingLabelEditId,
    clearPendingLabelEdit
  } = useDiagramContext()
  const { updateNodeData, getNode, getZoom } = useReactFlow()
  const rootRef = useRef<HTMLDivElement>(null)
  const labelBoxRef = useRef<HTMLDivElement>(null)
  const [leader, setLeader] = useState<ReturnType<typeof leaderLine>>(null)

  const locked = data?.locked === true
  const linkedPath = typeof data?.linkedDiagram === 'string' ? data.linkedDiagram : undefined
  const customPoints = (data?.connectionPoints ?? []) as ConnectionPoint[]
  const kindId = typeof data?.kind === 'string' ? data.kind : undefined
  const kind = stencilKind(kindId)
  const outside = stencilLabelOutside(kindId)
  const insets = stencilLabelInsets(kindId)
  // Where the label of a small shape sits; a free one is at an offset from the shape.
  const position = outside ? labelPositionOf(data?.labelPosition) : 'below'
  const offset = offsetOf(data?.labelOffset)
  const free = outside && position === 'free' && offset !== undefined
  const draggableLabel = free && selected && !locked
  const ownStyle = data?.style as NodeStyle | undefined
  const style = stencilStyle(kindId, ownStyle)
  const mark = stencilMarkOf(kind, data)
  const solid = stencilSolid(kind, data)
  // An event in the flow has a second ring inside the first; one that starts a flow has one.
  const doubled = stencilDoubleBorder(kind, data)
  const { addConnectionPointItem, onPointContextMenu } = useConnectionPointMenu(id, customPoints)

  // The kind's heavier border (an end) is a multiple of the border width the element has.
  const frameCss: CSSProperties = nodeContainerCss(style, theme)
  // In the light theme the kind's own light colours, which a flip of the stored ones would not give.
  if (theme === 'light') {
    const own = stencilLightColors(kindId, ownStyle)
    if (own.fill) frameCss.background = withOpacity(own.fill, ownStyle?.fillOpacity)
    if (own.stroke) frameCss.borderColor = withOpacity(own.stroke, ownStyle?.strokeOpacity)
  }
  if (kind.heavyBorder) {
    const width = ownStyle?.strokeWidth ?? NODE_STYLE_DEFAULTS.entity.strokeWidth
    frameCss.borderWidth = width * HEAVY_BORDER_FACTOR
  }
  // An end that stops the whole flow is a solid disc: the border colour fills it and the mark takes the
  // colour the fill had.
  let markColor: string | undefined
  if (solid) {
    markColor = String(frameCss.background ?? 'var(--default-entity-fill)')
    frameCss.background = frameCss.borderColor ?? 'var(--default-entity-stroke)'
  }
  // A mark that reads better larger or smaller than the standard size grows from its centre.
  const markScale = stencilMarkScale(mark)
  const markPercent = (doubled ? 42 : 46) * markScale
  const markBox: CSSProperties | undefined =
    kind.shape !== 'arrow' && markScale !== 1
      ? {
          top: `${(100 - markPercent) / 2}%`,
          left: `${(100 - markPercent) / 2}%`,
          width: `${markPercent}%`,
          height: `${markPercent}%`
        }
      : undefined

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
      const detachItem = getNode(id)?.parentId
        ? [{ label: 'Detach from parent', onSelect: () => detachFromParent(id) }]
        : []
      openContextMenu(event.clientX, event.clientY, [
        linkItems[0],
        ...linkItems.slice(1),
        ...detachItem,
        addConnectionPointItem(rect, event.clientX, event.clientY),
        {
          label: 'Select all behaviours',
          separatorBefore: true,
          onSelect: () => selectAllOfType('stencil')
        }
      ])
    },
    [
      id,
      openContextMenu,
      detachFromParent,
      getNode,
      linkedPath,
      handleLinkClick,
      updateNodeData,
      pushSnapshot,
      addConnectionPointItem,
      selectAllOfType
    ]
  )

  // Ctrl/Cmd+click opens the linked diagram, as on an entity.
  const onClick = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      if (!(event.ctrlKey || event.metaKey)) return
      handleLinkClick(id, event.clientX, event.clientY)
    },
    [id, handleLinkClick]
  )

  // The dotted line from a free label to its shape, from the measured sizes, with the same rules as
  // the exports.
  const offsetX = offset?.x
  const offsetY = offset?.y
  const shapeKind = kind.shape === 'circle' ? 'circle' : 'square'
  useLayoutEffect(() => {
    const root = rootRef.current
    const box = labelBoxRef.current
    if (!free || !root || !box || offsetX === undefined || offsetY === undefined) {
      setLeader(null)
      return
    }
    const compute = (): void => {
      const shape = { x: 0, y: 0, width: root.clientWidth, height: root.clientHeight }
      const size = { width: box.offsetWidth, height: box.offsetHeight }
      const placed = labelBox('free', { x: offsetX, y: offsetY }, shape, size)
      setLeader(leaderLine(shapeKind, shape, placed))
    }
    compute()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(compute)
    observer.observe(box)
    observer.observe(root)
    return () => observer.disconnect()
  }, [free, offsetX, offsetY, shapeKind, data?.label])

  // Dragging a free label moves it around its shape: one undo step for the whole drag.
  const onLabelPointerDown = (event: PointerEvent<HTMLDivElement>): void => {
    if (!draggableLabel || event.button !== 0 || !offset) return
    if ((event.target as HTMLElement).closest('textarea, input')) return
    const startX = event.clientX
    const startY = event.clientY
    const from = offset
    let moved = false
    const move = (e: globalThis.PointerEvent): void => {
      const zoom = getZoom() || 1
      const dx = (e.clientX - startX) / zoom
      const dy = (e.clientY - startY) / zoom
      if (!moved) {
        if (Math.hypot(dx, dy) * zoom < 3) return
        moved = true
        pushSnapshot()
      }
      updateNodeData(id, {
        labelOffset: { x: Math.round(from.x + dx), y: Math.round(from.y + dy) }
      })
    }
    const up = (): void => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  const label = (
    <EditableLabel
      className="stencil-node-label"
      inputClassName="entity-node-label-input"
      multiline
      autoEdit={pendingLabelEditId === id}
      onAutoEditStarted={clearPendingLabelEdit}
      style={nodeLabelCss(style, theme)}
      value={String(data?.label ?? '')}
      onCommit={(value) => {
        pushSnapshot()
        updateNodeData(id, { label: value })
      }}
    />
  )

  const labelContent = outside ? (
    <div
      ref={labelBoxRef}
      className={`stencil-node-label-box stencil-node-label-box--${position}${draggableLabel ? ' stencil-node-label-box--draggable nodrag' : ''}`}
      style={
        free && offset
          ? { left: `calc(50% + ${offset.x}px)`, top: `calc(50% + ${offset.y}px)` }
          : undefined
      }
      onPointerDown={onLabelPointerDown}
    >
      {label}
    </div>
  ) : (
    label
  )

  return (
    <div
      ref={rootRef}
      className={`stencil-node stencil-node--${kind.shape}${entityHighlightNodeId === id ? ' entity-highlighted' : ''}${searchMatchIds.has(id) ? ' search-match' : ''}`}
      data-stencil-kind={kind.id}
      style={{
        ...frameCss,
        ...(insets.right ? { paddingRight: 8 + insets.right } : {}),
        ...isolateStyle(id, isolateActive, searchMatchIds, isolateOpacity)
      }}
      onContextMenu={onContextMenu}
      onClick={onClick}
    >
      <NodeResizer
        isVisible={selected && !locked}
        minWidth={kind.shape === 'arrow' ? 80 : 24}
        minHeight={kind.shape === 'arrow' ? 32 : 24}
        keepAspectRatio={kind.shape !== 'arrow'}
        onResizeStart={() => groupResize.start(id)}
        onResize={(_, params) => groupResize.resize(id, params)}
        onResizeEnd={groupResize.end}
      />
      <ConnectionHandles storedPoints={customPoints} onPointContextMenu={onPointContextMenu} />
      {locked && <LockBadge />}
      {doubled && (
        <span
          className="stencil-node-ring"
          aria-hidden="true"
          style={{
            borderColor: frameCss.borderColor ?? 'var(--default-entity-stroke)',
            borderWidth: frameCss.borderWidth
          }}
        />
      )}
      {mark && (
        <svg
          className={`stencil-node-mark${kind.shape === 'arrow' ? ' stencil-node-mark--slot' : ''}${doubled ? ' stencil-node-mark--ringed' : ''}`}
          style={{ ...markBox, ...(markColor ? { color: markColor } : {}) }}
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            d={STENCIL_MARK_PATHS[mark]}
            fill={STENCIL_MARK_SOLID.has(mark) ? 'currentColor' : 'none'}
            stroke="currentColor"
            strokeWidth={MARK_STROKE}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
      {kind.shape === 'arrow' && (
        <span
          className="stencil-node-band"
          aria-hidden="true"
          style={{ background: frameCss.borderColor ?? 'var(--default-entity-stroke)' }}
        />
      )}
      {leader && (
        <svg className="stencil-node-leader" aria-hidden="true">
          <line x1={leader.x1} y1={leader.y1} x2={leader.x2} y2={leader.y2} />
        </svg>
      )}
      {labelContent}
    </div>
  )
}

export default memo(StencilNode)
