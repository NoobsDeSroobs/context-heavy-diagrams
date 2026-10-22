import { memo } from 'react'
import type { Edge, Node } from '@xyflow/react'
import type {
  ConnectionPointSide,
  EdgeStyle,
  MetadataEntry,
  NodeStyle,
  RequiredTagDefinition
} from '@shared/diagram'
import ItemPalette from './palette/ItemPalette'
import PropertyPanel from './properties/PropertyPanel'
import type { TransformPatch } from './properties/transformPatch'

// The right-side dock that's part of the diagram's own editing surface —
// see ADR 0013. Item palette when nothing is selected, property panel once
// something is. Each mode gets its own width (set via CSS on the two
// `*-mode` classes), not one fixed value for the dock as a whole.
// memo()'d so unrelated CanvasInner renders (panel toggles, search,
// context menus, pan, edge hover) don't re-render the property panel —
// see ADR 0073. Relies on every prop being referentially stable, which
// Canvas.tsx now ensures (memoized selectedNodes/selectedEdges,
// useCallback handlers, a stable pushSnapshot).
function DiagramDock({
  selectedNodes,
  selectedEdges,
  onAddEntity,
  onAddText,
  onAddContainer,
  onAddLine,
  onCreateMultipleEntities,
  onCreateMultipleContainers,
  onUpdateNodeStyle,
  onUpdateEdgeStyle,
  onUpdateTransform,
  onUpdateLocked,
  onUpdateNodeMetadata,
  onUpdateEdgeMetadata,
  onSetConnectionPointCount,
  maxConnectionPointsPerSide,
  requiredTags,
  beginContinuousEdit,
  endContinuousEdit,
  pushSnapshot,
  onSetDefaultStyle,
  styleBrushActive,
  onToggleStyleBrush
}: {
  selectedNodes: Node[]
  selectedEdges: Edge[]
  onAddEntity: () => void
  onAddText: () => void
  onAddContainer: () => void
  onAddLine: () => void
  onCreateMultipleEntities: () => void
  onCreateMultipleContainers: () => void
  onUpdateNodeStyle: (nodeIds: string[], patch: Partial<NodeStyle>) => void
  onUpdateEdgeStyle: (edgeIds: string[], patch: Partial<EdgeStyle>) => void
  onUpdateTransform: (nodeIds: string[], patch: TransformPatch) => void
  onUpdateLocked: (nodeIds: string[], locked: boolean) => void
  onUpdateNodeMetadata: (
    nodeId: string,
    metadata: Record<string, MetadataEntry> | undefined
  ) => void
  onUpdateEdgeMetadata: (
    edgeId: string,
    metadata: Record<string, MetadataEntry> | undefined
  ) => void
  onSetConnectionPointCount: (nodeId: string, side: ConnectionPointSide, totalCount: number) => void
  maxConnectionPointsPerSide: number
  requiredTags: RequiredTagDefinition[]
  beginContinuousEdit: () => void
  endContinuousEdit: () => void
  pushSnapshot: () => void
  onSetDefaultStyle: (type: 'entity' | 'container' | 'text', style: NodeStyle) => void
  styleBrushActive: boolean
  onToggleStyleBrush: () => void
}): React.JSX.Element {
  const hasSelection = selectedNodes.length > 0 || selectedEdges.length > 0

  return (
    <div
      className={
        hasSelection ? 'diagram-dock diagram-dock-properties' : 'diagram-dock diagram-dock-palette'
      }
    >
      {hasSelection ? (
        <PropertyPanel
          selectedNodes={selectedNodes}
          selectedEdges={selectedEdges}
          onUpdateNodeStyle={onUpdateNodeStyle}
          onUpdateEdgeStyle={onUpdateEdgeStyle}
          onUpdateTransform={onUpdateTransform}
          onUpdateLocked={onUpdateLocked}
          onUpdateNodeMetadata={onUpdateNodeMetadata}
          onUpdateEdgeMetadata={onUpdateEdgeMetadata}
          onSetConnectionPointCount={onSetConnectionPointCount}
          maxConnectionPointsPerSide={maxConnectionPointsPerSide}
          requiredTags={requiredTags}
          beginContinuousEdit={beginContinuousEdit}
          endContinuousEdit={endContinuousEdit}
          pushSnapshot={pushSnapshot}
          onSetDefaultStyle={onSetDefaultStyle}
          styleBrushActive={styleBrushActive}
          onToggleStyleBrush={onToggleStyleBrush}
        />
      ) : (
        <ItemPalette
          onAddEntity={onAddEntity}
          onAddText={onAddText}
          onAddContainer={onAddContainer}
          onAddLine={onAddLine}
          onCreateMultipleEntities={onCreateMultipleEntities}
          onCreateMultipleContainers={onCreateMultipleContainers}
        />
      )}
    </div>
  )
}

export default memo(DiagramDock)
