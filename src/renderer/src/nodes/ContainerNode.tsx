import { memo, useCallback, type CSSProperties, type MouseEvent } from 'react'
import { NodeResizer, useReactFlow, type NodeProps } from '@xyflow/react'
import type { ConnectionPoint, MetadataEntry, NodeStyle } from '@shared/diagram'
import EditableLabel from '../components/EditableLabel'
import HighlightChips from '../tagging/HighlightChips'
import LockBadge from '../tagging/LockBadge'
import { useDiagramContext } from '../useDiagramContext'
import { HIGHLIGHT_BORDER_WIDTH } from '@shared/tagging/highlights'
import { isolateStyle } from '../search/search'
import { nodeContainerCss, nodeLabelCss } from '../styling/nodeStyleCss'
import { ConnectionHandles } from './ConnectionHandles'
import { useConnectionPointMenu } from './connectionPoints'

export const CONTAINER_MIN_WIDTH = 160
export const CONTAINER_MIN_HEIGHT = 120

// Resizable, connectable, never rotated — same structural category as
// EntityNode, deliberately, not TextNode. See ADR 0012 for why (a container
// plausibly needs edges attached to it directly, e.g. an external system
// connecting to a "VPC" as a whole — rotating a connectable node reopens
// the edge-misattachment bug ADR 0004 already solved once).
//
// A transparent body (not a filled shape) so contained nodes stay visible
// through it — those are separate sibling elements in React Flow's render
// tree, not DOM children of this div, so they aren't affected by anything
// this component does with pointer events or z-order.
function ContainerNode({ id, data, selected }: NodeProps): React.JSX.Element {
  const {
    pushSnapshot,
    openContextMenu,
    openReferencesFor,
    attachContainedNodes,
    detachFromParent,
    matchHighlights,
    theme,
    entityHighlightNodeId,
    searchMatchIds,
    isolateActive,
    isolateOpacity,
    selectAllOfType,
    groupResize
  } = useDiagramContext()
  const { updateNodeData, getNode } = useReactFlow()
  const locked = data?.locked === true
  const customPoints = (data?.connectionPoints ?? []) as ConnectionPoint[]
  const style = data?.style as NodeStyle | undefined
  const { addConnectionPointItem, onPointContextMenu } = useConnectionPointMenu(id, customPoints)

  // See EntityNode's identical treatment / ADR 0025.
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
      const detachItem = getNode(id)?.parentId
        ? [{ label: 'Detach from parent', onSelect: () => detachFromParent(id) }]
        : []
      openContextMenu(event.clientX, event.clientY, [
        { label: 'Attach contained entities', onSelect: () => attachContainedNodes(id) },
        ...detachItem,
        { label: 'Reference images…', onSelect: () => openReferencesFor(id) },
        addConnectionPointItem(rect, event.clientX, event.clientY),
        {
          label: 'Select all containers',
          separatorBefore: true,
          onSelect: () => selectAllOfType('container')
        }
      ])
    },
    [
      openContextMenu,
      openReferencesFor,
      addConnectionPointItem,
      attachContainedNodes,
      detachFromParent,
      getNode,
      id,
      selectAllOfType
    ]
  )

  return (
    <div
      className={`container-node${entityHighlightNodeId === id ? ' entity-highlighted' : ''}${searchMatchIds.has(id) ? ' search-match' : ''}`}
      style={{
        ...nodeContainerCss(style, theme),
        ...highlightCss,
        ...isolateStyle(id, isolateActive, searchMatchIds, isolateOpacity)
      }}
      onContextMenu={onContextMenu}
    >
      <NodeResizer
        isVisible={selected && !locked}
        minWidth={CONTAINER_MIN_WIDTH}
        minHeight={CONTAINER_MIN_HEIGHT}
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
      <EditableLabel
        className="container-node-label"
        inputClassName="container-node-label-input"
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

export default memo(ContainerNode)
