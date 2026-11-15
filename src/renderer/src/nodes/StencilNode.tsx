import { memo, useCallback, type CSSProperties, type MouseEvent } from 'react'
import { NodeResizer, useReactFlow, type NodeProps } from '@xyflow/react'
import type { ConnectionPoint, NodeStyle } from '@shared/diagram'
import {
  HEAVY_BORDER_FACTOR,
  STENCIL_KINDS,
  stencilKind,
  stencilLabelOutside,
  stencilStyle,
  type StencilMark
} from '@shared/stencils/kinds'
import { NODE_STYLE_DEFAULTS } from '@shared/styling/styleDefaults'
import EditableLabel from '../ui/EditableLabel'
import LockBadge from '../tagging/LockBadge'
import { useDiagramContext } from '../canvas/useDiagramContext'
import { isolateStyle } from '../search/search'
import { nodeContainerCss, nodeLabelCss } from '../styling/nodeStyleCss'
import { ConnectionHandles } from './ConnectionHandles'
import { useConnectionPointMenu } from './connectionPoints'

// An event or a verb of a flow (ADR 0180): a base shape with an optional mark on it, taken from the
// element's kind. Resizable, connectable, never rotated, no notes, tags or icons of its own, and one
// link to another diagram. The small shapes carry their label below them; a step carries it inside.

// Drawn by the app as vector graphics, in a 24-unit box that the CSS scales to the shape.
const MARK_PATH: Record<StencilMark, string> = {
  cross: 'M6 6L18 18M6 18L18 6',
  plus: 'M5 12H19M12 5V19'
}

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
    setStencilKind,
    groupResize,
    pendingLabelEditId,
    clearPendingLabelEdit
  } = useDiagramContext()
  const { updateNodeData, getNode } = useReactFlow()

  const locked = data?.locked === true
  const linkedPath = typeof data?.linkedDiagram === 'string' ? data.linkedDiagram : undefined
  const customPoints = (data?.connectionPoints ?? []) as ConnectionPoint[]
  const kindId = typeof data?.kind === 'string' ? data.kind : undefined
  const kind = stencilKind(kindId)
  const outside = stencilLabelOutside(kindId)
  const ownStyle = data?.style as NodeStyle | undefined
  const style = stencilStyle(kindId, ownStyle)
  const { addConnectionPointItem, onPointContextMenu } = useConnectionPointMenu(id, customPoints)

  // The kind's heavier border (an end) is a multiple of the border width the element has.
  const frameCss: CSSProperties = nodeContainerCss(style, theme)
  if (kind.heavyBorder) {
    const width = ownStyle?.strokeWidth ?? NODE_STYLE_DEFAULTS.entity.strokeWidth
    frameCss.borderWidth = width * HEAVY_BORDER_FACTOR
  }

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
      const kindItems = STENCIL_KINDS.filter((k) => k.id !== kind.id).map((k) => ({
        label: `Change to ${k.name}`,
        onSelect: () => setStencilKind([id], k.id)
      }))
      openContextMenu(event.clientX, event.clientY, [
        ...kindItems,
        { ...linkItems[0], separatorBefore: true },
        ...linkItems.slice(1),
        ...detachItem,
        addConnectionPointItem(rect, event.clientX, event.clientY),
        {
          label: 'Select all steps and events',
          separatorBefore: true,
          onSelect: () => selectAllOfType('stencil')
        }
      ])
    },
    [
      id,
      kind.id,
      openContextMenu,
      detachFromParent,
      getNode,
      linkedPath,
      handleLinkClick,
      updateNodeData,
      pushSnapshot,
      addConnectionPointItem,
      selectAllOfType,
      setStencilKind
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

  const label = (
    <EditableLabel
      className={`stencil-node-label${outside ? ' stencil-node-label--outside' : ''}`}
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

  return (
    <div
      className={`stencil-node stencil-node--${kind.shape}${entityHighlightNodeId === id ? ' entity-highlighted' : ''}${searchMatchIds.has(id) ? ' search-match' : ''}`}
      data-stencil-kind={kind.id}
      style={{
        ...frameCss,
        ...isolateStyle(id, isolateActive, searchMatchIds, isolateOpacity)
      }}
      onContextMenu={onContextMenu}
      onClick={onClick}
    >
      <NodeResizer
        isVisible={selected && !locked}
        minWidth={kind.shape === 'rounded' ? 60 : 24}
        minHeight={kind.shape === 'rounded' ? 32 : 24}
        keepAspectRatio={kind.shape !== 'rounded'}
        onResizeStart={() => groupResize.start(id)}
        onResize={(_, params) => groupResize.resize(id, params)}
        onResizeEnd={groupResize.end}
      />
      <ConnectionHandles storedPoints={customPoints} onPointContextMenu={onPointContextMenu} />
      {locked && <LockBadge />}
      {kind.mark && (
        <svg className="stencil-node-mark" viewBox="0 0 24 24" aria-hidden="true">
          <path
            d={MARK_PATH[kind.mark]}
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        </svg>
      )}
      {label}
    </div>
  )
}

export default memo(StencilNode)
