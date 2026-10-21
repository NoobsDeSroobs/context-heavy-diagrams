import { memo, useCallback, type CSSProperties, type MouseEvent } from 'react'
import { NodeResizer, useReactFlow, type NodeProps } from '@xyflow/react'
import type { ConnectionPoint, IconRef, IconSlot, MetadataEntry, NodeStyle } from '@shared/diagram'
import EditableLabel from '../ui/EditableLabel'
import HighlightChips from '../tagging/HighlightChips'
import IconSlotView from '../icons/IconSlotView'
import LockBadge from '../tagging/LockBadge'
import { useDiagramContext } from '../useDiagramContext'
import { HIGHLIGHT_BORDER_WIDTH } from '@shared/tagging/highlights'
import { isolateStyle } from '../search/search'
import { nodeContainerCss, nodeLabelCss } from '../styling/nodeStyleCss'
import { ConnectionHandles } from './ConnectionHandles'
import { useConnectionPointMenu } from './connectionPoints'

export const ENTITY_MIN_WIDTH = 60
export const ENTITY_MIN_HEIGHT = 40

const SLOT_CLASS: Record<IconSlot, string> = {
  topLeft: 'entity-node-icon entity-node-icon-top-left',
  topRight: 'entity-node-icon entity-node-icon-top-right',
  bottomLeft: 'entity-node-icon entity-node-icon-bottom-left',
  bottomRight: 'entity-node-icon entity-node-icon-bottom-right'
}
const SLOTS = Object.keys(SLOT_CLASS) as IconSlot[]

// Keys IconSlotView by icon identity, not just slot — React
// then remounts a fresh instance whenever the icon actually changes
// (including cleared), so IconSlotView never needs to manually reset its
// own svg/dataUrl state mid-fetch to avoid a stale-icon flash.
function iconSlotKey(slot: IconSlot, icon: IconRef | undefined): string {
  if (!icon) return `${slot}:none`
  return icon.source === 'builtin' ? `${slot}:builtin:${icon.id}` : `${slot}:custom:${icon.path}`
}

// Resizable, connectable, never rotated — see docs/decisions/0004-shape-text-node-split.md
// for why rotation is deliberately excluded here (it's what TextNode is for).
//
// Icon slots deliberately render at the true corners with no special
// handling to dodge NodeResizer's corner handles — same stacking order the
// entity's own body already has under them.
// The icon *picker* and details panel are NOT rendered here — see
// DiagramContext for why.
function EntityNode({ id, data, selected }: NodeProps): React.JSX.Element {
  const {
    diagramPath,
    openContextMenu,
    openIconPicker,
    openDetailsPanel,
    openReferencesFor,
    detachFromParent,
    handleLinkClick,
    pushSnapshot,
    matchHighlights,
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
  const { updateNodeData, getNode } = useReactFlow()

  const locked = data?.locked === true
  const icons = (data?.icons ?? {}) as Partial<Record<IconSlot, IconRef>>
  const linkedPath = typeof data?.linkedDiagram === 'string' ? data.linkedDiagram : undefined
  const customPoints = (data?.connectionPoints ?? []) as ConnectionPoint[]
  const style = data?.style as NodeStyle | undefined
  const { addConnectionPointItem, onPointContextMenu } = useConnectionPointMenu(id, customPoints)

  // See ADR 0025: exactly one matching enabled highlight
  // overrides the border; two or more render as chips instead. Layered
  // after nodeContainerCss(style) so it takes precedence without touching
  // the actually-stored style.
  const highlightMatches = matchHighlights(
    data?.metadata as Record<string, MetadataEntry> | undefined
  )
  const highlightCss: CSSProperties =
    highlightMatches.length === 1
      ? { borderColor: highlightMatches[0].color, borderWidth: HIGHLIGHT_BORDER_WIDTH }
      : {}

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
        { label: 'Add icon', onSelect: () => openIconPicker(id, rect) },
        { label: 'See details', onSelect: () => openDetailsPanel(id) },
        { label: 'Reference images…', onSelect: () => openReferencesFor(id) },
        ...linkItems,
        ...detachItem,
        addConnectionPointItem(rect, event.clientX, event.clientY),
        {
          label: 'Select all entities',
          separatorBefore: true,
          onSelect: () => selectAllOfType('entity')
        }
      ])
    },
    [
      id,
      openContextMenu,
      openIconPicker,
      openDetailsPanel,
      openReferencesFor,
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

  // Ctrl/Cmd+click is distinct from plain click (selection, handled by React
  // Flow itself) and right-click (context menu, above) — it navigates a linked diagram.
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
    <div
      className={`entity-node${entityHighlightNodeId === id ? ' entity-highlighted' : ''}${searchMatchIds.has(id) ? ' search-match' : ''}`}
      style={{
        ...nodeContainerCss(style, theme),
        ...highlightCss,
        ...isolateStyle(id, isolateActive, searchMatchIds, isolateOpacity)
      }}
      onContextMenu={onContextMenu}
      onClick={onClick}
    >
      <NodeResizer
        isVisible={selected && !locked}
        minWidth={ENTITY_MIN_WIDTH}
        minHeight={ENTITY_MIN_HEIGHT}
        onResizeStart={() => groupResize.start(id)}
        onResize={(_, params) => groupResize.resize(id, params)}
        onResizeEnd={groupResize.end}
      />
      <ConnectionHandles storedPoints={customPoints} onPointContextMenu={onPointContextMenu} />
      {locked && <LockBadge />}
      {highlightMatches.length >= 2 && (
        <div className="highlight-chips-anchor">
          <HighlightChips highlights={highlightMatches} />
        </div>
      )}
      {SLOTS.map((slot) => (
        <IconSlotView
          key={iconSlotKey(slot, icons[slot])}
          icon={icons[slot]}
          diagramPath={diagramPath}
          className={SLOT_CLASS[slot]}
        />
      ))}
      <EditableLabel
        className="entity-node-label"
        inputClassName="entity-node-label-input"
        multiline
        autoEdit={pendingLabelEditId === id}
        onAutoEditStarted={clearPendingLabelEdit}
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

export default memo(EntityNode)
