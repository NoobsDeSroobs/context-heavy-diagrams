import type { Edge, Node } from '@xyflow/react'
import type { ConnectionPointSide, EdgeStyle, MetadataEntry, NodeStyle, RequiredTagDefinition } from '@shared/diagram'
import ItemPalette from './ItemPalette'
import PropertyPanel, { type TransformPatch } from './PropertyPanel'

// The right-side dock that's part of the diagram's own editing surface —
// see ADR 0013. Item palette when nothing is selected, property panel once
// something is. Each mode gets its own width (set via CSS on the two
// `*-mode` classes), not one fixed value for the dock as a whole.
export default function DiagramDock({
  selectedNodes,
  selectedEdges,
  onAddShape,
  onAddText,
  onAddContainer,
  onUpdateNodeStyle,
  onUpdateEdgeStyle,
  onUpdateTransform,
  onUpdateNodeMetadata,
  onUpdateEdgeMetadata,
  onSetConnectionPointCount,
  maxConnectionPointsPerSide,
  requiredTags,
  beginContinuousEdit,
  endContinuousEdit,
  pushSnapshot
}: {
  selectedNodes: Node[]
  selectedEdges: Edge[]
  onAddShape: () => void
  onAddText: () => void
  onAddContainer: () => void
  onUpdateNodeStyle: (nodeIds: string[], patch: Partial<NodeStyle>) => void
  onUpdateEdgeStyle: (edgeIds: string[], patch: Partial<EdgeStyle>) => void
  onUpdateTransform: (nodeIds: string[], patch: TransformPatch) => void
  onUpdateNodeMetadata: (nodeId: string, metadata: Record<string, MetadataEntry> | undefined) => void
  onUpdateEdgeMetadata: (edgeId: string, metadata: Record<string, MetadataEntry> | undefined) => void
  onSetConnectionPointCount: (nodeId: string, side: ConnectionPointSide, totalCount: number) => void
  maxConnectionPointsPerSide: number
  requiredTags: RequiredTagDefinition[]
  beginContinuousEdit: () => void
  endContinuousEdit: () => void
  pushSnapshot: () => void
}): React.JSX.Element {
  const hasSelection = selectedNodes.length > 0 || selectedEdges.length > 0

  return (
    <div className={hasSelection ? 'diagram-dock diagram-dock-properties' : 'diagram-dock diagram-dock-palette'}>
      {hasSelection ? (
        <PropertyPanel
          selectedNodes={selectedNodes}
          selectedEdges={selectedEdges}
          onUpdateNodeStyle={onUpdateNodeStyle}
          onUpdateEdgeStyle={onUpdateEdgeStyle}
          onUpdateTransform={onUpdateTransform}
          onUpdateNodeMetadata={onUpdateNodeMetadata}
          onUpdateEdgeMetadata={onUpdateEdgeMetadata}
          onSetConnectionPointCount={onSetConnectionPointCount}
          maxConnectionPointsPerSide={maxConnectionPointsPerSide}
          requiredTags={requiredTags}
          beginContinuousEdit={beginContinuousEdit}
          endContinuousEdit={endContinuousEdit}
          pushSnapshot={pushSnapshot}
        />
      ) : (
        <ItemPalette onAddShape={onAddShape} onAddText={onAddText} onAddContainer={onAddContainer} />
      )}
    </div>
  )
}
