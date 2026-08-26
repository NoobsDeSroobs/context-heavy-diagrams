import { memo, useCallback, type CSSProperties, type MouseEvent } from 'react'
import { NodeResizer, useReactFlow, type NodeProps } from '@xyflow/react'
import type { ConnectionPoint, IconRef, IconSlot, MetadataEntry, NodeStyle } from '@shared/diagram'
import EditableLabel from '../components/EditableLabel'
import HighlightChips from '../components/HighlightChips'
import IconSlotView from '../components/IconSlotView'
import LockBadge from '../components/LockBadge'
import { useDiagramContext } from '../useDiagramContext'
import { useDetailsTooltip } from '../hooks/useDetailsTooltip'
import { HIGHLIGHT_BORDER_WIDTH } from '../highlights'
import { isolateStyle } from '../search'
import { nodeContainerCss, nodeLabelCss } from '../styles/nodeStyleCss'
import { ConnectionHandles } from './ConnectionHandles'
import { useConnectionPointMenu } from './connectionPoints'

export const SHAPE_MIN_WIDTH = 60
export const SHAPE_MIN_HEIGHT = 40

const SLOT_CLASS: Record<IconSlot, string> = {
  topLeft: 'shape-node-icon shape-node-icon-top-left',
  topRight: 'shape-node-icon shape-node-icon-top-right',
  bottomLeft: 'shape-node-icon shape-node-icon-bottom-left',
  bottomRight: 'shape-node-icon shape-node-icon-bottom-right'
}
const SLOTS = Object.keys(SLOT_CLASS) as IconSlot[]

// Keys IconSlotView by icon identity, not just slot (epic 0028) — React
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
// shape's own body already has under them, per user direction on epic 0007.
// The icon *picker* and details panel are NOT rendered here — see
// DiagramContext for why.
function ShapeNode({ id, data, selected }: NodeProps): React.JSX.Element {
  const {
    diagramPath,
    openContextMenu,
    openIconPicker,
    openColorPicker,
    openDetailsPanel,
    handleLinkClick,
    pushSnapshot,
    matchHighlights,
    theme,
    entityHighlightNodeId,
    searchMatchIds,
    isolateActive,
    isolateOpacity,
    selectAllOfType
  } = useDiagramContext()
  const { updateNodeData } = useReactFlow()

  const locked = data?.locked === true
  const icons = (data?.icons ?? {}) as Partial<Record<IconSlot, IconRef>>
  const detailsPath = typeof data?.details === 'string' ? data.details : undefined
  const linkedPath = typeof data?.linkedDiagram === 'string' ? data.linkedDiagram : undefined
  const customPoints = (data?.connectionPoints ?? []) as ConnectionPoint[]
  const style = data?.style as NodeStyle | undefined
  const tooltip = useDetailsTooltip(diagramPath, detailsPath)
  const { addConnectionPointItem, onPointContextMenu } = useConnectionPointMenu(id, customPoints)

  // See epic 0026/ADR 0025: exactly one matching enabled highlight
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
      openContextMenu(event.clientX, event.clientY, [
        { label: 'Add icon', onSelect: () => openIconPicker(id, rect) },
        { label: 'Fill…', onSelect: () => openColorPicker(id, 'fill', rect) },
        { label: 'Border…', onSelect: () => openColorPicker(id, 'border', rect) },
        { label: 'See details', onSelect: () => openDetailsPanel(id) },
        ...linkItems,
        addConnectionPointItem(rect, event.clientX, event.clientY),
        {
          label: 'Select all shapes',
          separatorBefore: true,
          onSelect: () => selectAllOfType('shape')
        }
      ])
    },
    [
      id,
      openContextMenu,
      openIconPicker,
      openColorPicker,
      openDetailsPanel,
      linkedPath,
      handleLinkClick,
      updateNodeData,
      pushSnapshot,
      addConnectionPointItem,
      selectAllOfType
    ]
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
    <div
      className={`shape-node${entityHighlightNodeId === id ? ' entity-highlighted' : ''}${searchMatchIds.has(id) ? ' search-match' : ''}`}
      style={{
        ...nodeContainerCss(style, theme),
        ...highlightCss,
        ...isolateStyle(id, isolateActive, searchMatchIds, isolateOpacity)
      }}
      onContextMenu={onContextMenu}
      onClick={onClick}
      title={tooltip}
    >
      <NodeResizer
        isVisible={selected && !locked}
        minWidth={SHAPE_MIN_WIDTH}
        minHeight={SHAPE_MIN_HEIGHT}
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
        className="shape-node-label"
        inputClassName="shape-node-label-input"
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

export default memo(ShapeNode)
