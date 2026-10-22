import type { Edge, Node } from '@xyflow/react'
import type {
  ConnectionPointSide,
  EdgeStyle,
  MetadataEntry,
  NodeStyle,
  RequiredTagDefinition
} from '@shared/diagram'
import { CollapsibleSection } from '../ui/fields'
import MetadataSection from '../tagging/MetadataSection'
import ReferencesSection from '../references/ReferencesSection'
import { canBrushNodeType } from '../styling/styleBrush'
import { NodeStyleFields } from './NodeStyleFields'
import { EdgeFields } from './EdgeFields'
import { LineStyleFields } from './LineStyleFields'
import { ConnectionPointFields } from './ConnectionPointFields'
import { nodeStyleOf } from './styleAccess'
import type { TransformPatch } from './transformPatch'

interface PropertyPanelProps {
  selectedNodes: Node[]
  selectedEdges: Edge[]
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
  // Copies one selected node's current style into preferences.defaultStyles
  // for its type (ADR 0048) — only offered for entity/container/text, only
  // when exactly one node of that type is selected (a style is only
  // well-defined for a single node, not a multi-selection). Edges
  // already have their own equivalent via the toolbar swatch (ADR 0045).
  onSetDefaultStyle: (type: 'entity' | 'container' | 'text', style: NodeStyle) => void
  requiredTags: RequiredTagDefinition[]
  beginContinuousEdit: () => void
  endContinuousEdit: () => void
  pushSnapshot: () => void
  // Copy style / apply mode (ADR 0095): the panel only offers the entry point
  // and the exit; the brush itself lives in Canvas.
  styleBrushActive: boolean
  onToggleStyleBrush: () => void
}

// Entity/container share NodeStyleFields' four groups; text gets the same
// component minus fill/border, since a text node's "look" is font +
// transform only (deliberately still allows a fill for consistency's sake —
// see ADR 0014 — even though it's rare in practice). Rotation is text-only
// (ADR 0004/0012 — entities/containers are never rotated).
const TYPE_LABELS: Record<string, string> = {
  entity: 'Entities',
  container: 'Containers',
  text: 'Text',
  line: 'Lines'
}
const MIN_SIZE: Record<string, { width: number; height: number }> = {
  entity: { width: 60, height: 40 },
  container: { width: 160, height: 120 },
  text: { width: 40, height: 24 }
}

export default function PropertyPanel({
  selectedNodes,
  selectedEdges,
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
}: PropertyPanelProps): React.JSX.Element {
  const byType = new Map<string, Node[]>()
  for (const n of selectedNodes) {
    const type = n.type ?? 'entity'
    byType.set(type, [...(byType.get(type) ?? []), n])
  }
  const nodeGroups = Array.from(byType.entries())
  const groupCount = nodeGroups.length + (selectedEdges.length > 0 ? 1 : 0)

  // Metadata section: single-selection only (see MetadataSection's own
  // comment), and only for the node types that actually carry metadata —
  // Text/Anchor never do (ADR 0022).
  const metadataTarget: { kind: 'node'; node: Node } | { kind: 'edge'; edge: Edge } | undefined =
    selectedNodes.length + selectedEdges.length === 1
      ? selectedNodes.length === 1 &&
        (selectedNodes[0].type === 'entity' || selectedNodes[0].type === 'container')
        ? { kind: 'node', node: selectedNodes[0] }
        : selectedEdges.length === 1
          ? { kind: 'edge', edge: selectedEdges[0] }
          : undefined
      : undefined

  const renderNodeGroup = (type: string, nodes: Node[]): React.JSX.Element => {
    const ids = nodes.map((n) => n.id)
    if (type === 'line') {
      return (
        <LineStyleFields
          key={type}
          nodes={nodes}
          updateStyle={(patch) => onUpdateNodeStyle(ids, patch)}
          updateLocked={(locked) => onUpdateLocked(ids, locked)}
          beginContinuousEdit={beginContinuousEdit}
          endContinuousEdit={endContinuousEdit}
          pushSnapshot={pushSnapshot}
        />
      )
    }
    const min = MIN_SIZE[type] ?? MIN_SIZE.entity
    return (
      <NodeStyleFields
        key={type}
        nodes={nodes}
        minWidth={min.width}
        minHeight={min.height}
        includeRotation={type === 'text'}
        updateStyle={(patch) => onUpdateNodeStyle(ids, patch)}
        updateTransform={(patch) => onUpdateTransform(ids, patch)}
        updateLocked={(locked) => onUpdateLocked(ids, locked)}
        beginContinuousEdit={beginContinuousEdit}
        endContinuousEdit={endContinuousEdit}
        pushSnapshot={pushSnapshot}
      />
    )
  }

  const renderEdgeGroup = (): React.JSX.Element => {
    const ids = selectedEdges.map((e) => e.id)
    return (
      <EdgeFields
        edges={selectedEdges}
        updateStyle={(patch) => onUpdateEdgeStyle(ids, patch)}
        beginContinuousEdit={beginContinuousEdit}
        endContinuousEdit={endContinuousEdit}
        pushSnapshot={pushSnapshot}
      />
    )
  }

  // One element that can be a brush source (an entity/container/text/line or an
  // edge) gets "Copy style"; while a brush is active, any selection shows
  // the way out instead.
  const singleElement = selectedNodes.length + selectedEdges.length === 1
  const canCopyStyle =
    singleElement && (selectedEdges.length === 1 || canBrushNodeType(selectedNodes[0].type))
  const styleBrushButton =
    canCopyStyle || styleBrushActive ? (
      <button
        type="button"
        className={styleBrushActive ? 'style-brush-button active' : 'style-brush-button'}
        title={
          styleBrushActive
            ? 'Stop applying the copied style (Esc)'
            : 'Copy this element’s style, then click other elements of the same type to apply it'
        }
        onClick={onToggleStyleBrush}
      >
        {styleBrushActive ? 'Stop applying style' : '🖌 Copy style'}
      </button>
    ) : null

  // "Set as default style": exactly one entity, container or text node selected
  // (see PropertyPanelProps' comment on onSetDefaultStyle). It sits beside
  // "Copy style" because both act on the style of the element you are looking at.
  const defaultStyleType =
    selectedNodes.length === 1 && selectedEdges.length === 0
      ? (['entity', 'container', 'text'] as const).find((t) => t === selectedNodes[0].type)
      : undefined
  const setDefaultButton = defaultStyleType ? (
    <button
      type="button"
      className="property-set-default"
      onClick={() => onSetDefaultStyle(defaultStyleType, nodeStyleOf(selectedNodes[0]))}
      title="Newly created elements of this type will start with this exact style"
    >
      Set as default style
    </button>
  ) : null
  const styleActions =
    styleBrushButton || setDefaultButton ? (
      <div className="property-style-actions">
        {styleBrushButton}
        {setDefaultButton}
      </div>
    ) : null

  if (groupCount === 0) return <div className="property-panel-empty">Nothing selected</div>

  // Same-type selection (including a single edge): no extra "Type (N)"
  // wrapper, just the groups directly. Mixed-type selection: stacked,
  // collapsible per-type sections.
  if (groupCount === 1) {
    return (
      <div className="property-panel">
        {styleActions}
        {nodeGroups.map(([type, nodes]) => renderNodeGroup(type, nodes))}
        {selectedEdges.length > 0 && renderEdgeGroup()}
        {metadataTarget?.kind === 'node' && (
          <ConnectionPointFields
            node={metadataTarget.node}
            maxPerSide={maxConnectionPointsPerSide}
            onSetCount={(side, count) =>
              onSetConnectionPointCount(metadataTarget.node.id, side, count)
            }
          />
        )}
        {metadataTarget?.kind === 'node' && <ReferencesSection node={metadataTarget.node} />}
        {metadataTarget && (
          <MetadataSection
            metadata={
              metadataTarget.kind === 'node'
                ? (metadataTarget.node.data?.metadata as Record<string, MetadataEntry> | undefined)
                : (metadataTarget.edge.data?.metadata as Record<string, MetadataEntry> | undefined)
            }
            onChange={(metadata) =>
              metadataTarget.kind === 'node'
                ? onUpdateNodeMetadata(metadataTarget.node.id, metadata)
                : onUpdateEdgeMetadata(metadataTarget.edge.id, metadata)
            }
            requiredTags={requiredTags}
            pushSnapshot={pushSnapshot}
          />
        )}
      </div>
    )
  }

  return (
    <div className="property-panel">
      {styleActions}
      {nodeGroups.map(([type, nodes]) => (
        <CollapsibleSection
          key={type}
          title={`${TYPE_LABELS[type] ?? type} (${nodes.length})`}
          sectionKey={`group-${type}`}
        >
          {renderNodeGroup(type, nodes)}
        </CollapsibleSection>
      ))}
      {selectedEdges.length > 0 && (
        <CollapsibleSection title={`Edges (${selectedEdges.length})`} sectionKey="group-edges">
          {renderEdgeGroup()}
        </CollapsibleSection>
      )}
    </div>
  )
}
