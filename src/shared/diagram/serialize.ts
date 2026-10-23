import type {
  EdgeDirection,
  EdgeDirectionSet,
  EdgeDirectionSetLegend,
  EdgeDirectionSetStyle
} from '../edges/schema.ts'
import type { JsonValue, MetadataEntry } from '../tagging/schema.ts'
import type { DiagramSecurity, RiskCell } from '../threat-matrix/schema.ts'
import type { DiagramFile } from './file.ts'

// Recursively sorts object keys alphabetically — applied to metadata dicts
// specifically (see ADR 0022's Determinism note, carried over from ADR
// 0009), so a bucket entry's own nested object values also get consistent
// key order, not just the top level. Arrays keep their existing element
// order (position is meaningful there); only plain-object keys get sorted.
function sortKeysDeep<T extends JsonValue>(value: T): T {
  if (Array.isArray(value)) return value.map((v) => sortKeysDeep(v)) as T
  if (value !== null && typeof value === 'object') {
    const sorted: Record<string, JsonValue> = {}
    for (const key of Object.keys(value).sort()) {
      sorted[key] = sortKeysDeep((value as Record<string, JsonValue>)[key])
    }
    return sorted as T
  }
  return value
}

// Fixed key order for an EdgeDirectionSet's default style (ADR 0083);
// dropped entirely when it carries nothing. Also accepts (and up-converts)
// the pre-ADR-0083 `legend` shape, so a file that never passed through the
// renderer's load migration still serializes cleanly.
function sortedDirectionSetStyle(set: EdgeDirectionSet): EdgeDirectionSetStyle | undefined {
  const legacy = (set as { legend?: EdgeDirectionSetLegend }).legend
  const style: EdgeDirectionSetStyle | undefined =
    set.style ??
    (legacy
      ? {
          stroke: legacy.color,
          lineStyle: legacy.lineStyle,
          startMarker: legacy.startMarker,
          endMarker: legacy.endMarker
        }
      : undefined)
  if (!style) return undefined
  const { stroke, strokeWidth, strokeOpacity, lineStyle, startMarker, endMarker } = style
  if (
    stroke === undefined &&
    strokeWidth === undefined &&
    strokeOpacity === undefined &&
    lineStyle === undefined &&
    startMarker === undefined &&
    endMarker === undefined
  ) {
    return undefined
  }
  return { stroke, strokeWidth, strokeOpacity, lineStyle, startMarker, endMarker }
}

// Deterministic per-edge directionSets: set ids in sorted order, each
// EdgeDirection with a fixed key order (undefined handles dropped by
// JSON.stringify). Only emitted when the diagram actually has >= 2 sets.
function sortedDirectionSets(
  directionSets: Record<string, EdgeDirection> | undefined,
  hasMultipleSets: boolean
): Record<string, EdgeDirection> | undefined {
  if (!hasMultipleSets || !directionSets || Object.keys(directionSets).length === 0) {
    return undefined
  }
  const sorted: Record<string, EdgeDirection> = {}
  for (const key of Object.keys(directionSets).sort()) {
    const d = directionSets[key]
    sorted[key] = {
      source: d.source,
      target: d.target,
      sourceHandle: d.sourceHandle,
      targetHandle: d.targetHandle
    }
  }
  return sorted
}

// Fixed key order for one RiskCell; notes dropped when blank.
function orderedRiskCell(cell: RiskCell): RiskCell {
  return {
    probability: cell.probability,
    consequence: cell.consequence,
    probabilityNote: cell.probabilityNote || undefined,
    consequenceNote: cell.consequenceNote || undefined
  }
}

// A node's `data.security` map — threat ids sorted, each cell key-ordered.
// Dropped entirely when empty or on a non-'entity' node (ADR 0082: sparse
// storage, entities only).
function sortedNodeSecurity(
  security: Record<string, RiskCell> | undefined,
  nodeType: string | undefined
): Record<string, RiskCell> | undefined {
  if (nodeType !== 'entity' || !security || Object.keys(security).length === 0) return undefined
  const sorted: Record<string, RiskCell> = {}
  for (const key of Object.keys(security).sort()) sorted[key] = orderedRiskCell(security[key])
  return sorted
}

// The diagram-level `security` block — deterministic key order, ordered
// arrays kept as-is (threats/matrixEntityIds order is meaningful), hidden id
// lists sorted, empty optional pieces dropped. Emitted only when it carries
// something (ADR 0082).
function orderedDiagramSecurity(
  security: DiagramSecurity | undefined
): DiagramSecurity | undefined {
  if (!security) return undefined
  if (security.threats.length === 0 && security.matrixEntityIds.length === 0) return undefined
  const hiddenThreatIds =
    security.hiddenThreatIds && security.hiddenThreatIds.length > 0
      ? [...security.hiddenThreatIds].sort()
      : undefined
  const hiddenEntityIds =
    security.hiddenEntityIds && security.hiddenEntityIds.length > 0
      ? [...security.hiddenEntityIds].sort()
      : undefined
  return {
    threats: security.threats.map((t) => ({
      id: t.id,
      name: t.name,
      description: t.description || undefined
    })),
    hiddenThreatIds,
    matrixEntityIds: security.matrixEntityIds,
    hiddenEntityIds,
    probabilityScale:
      security.probabilityScale && security.probabilityScale.length > 0
        ? security.probabilityScale.map((l) => ({
            value: l.value,
            label: l.label,
            description: l.description
          }))
        : undefined,
    consequenceScale:
      security.consequenceScale && security.consequenceScale.length > 0
        ? security.consequenceScale.map((l) => ({
            value: l.value,
            label: l.label,
            description: l.description
          }))
        : undefined
    // combineMethod / aggregateMethod are session-only, never serialized (ADR 0088).
  }
}

function sortedMetadata(
  metadata: Record<string, MetadataEntry> | undefined
): Record<string, MetadataEntry> | undefined {
  if (!metadata || Object.keys(metadata).length === 0) return undefined
  const sorted: Record<string, MetadataEntry> = {}
  for (const key of Object.keys(metadata).sort()) {
    const entry = metadata[key]
    sorted[key] = entry.lock
      ? { value: sortKeysDeep(entry.value), lock: entry.lock }
      : { value: sortKeysDeep(entry.value) }
  }
  return sorted
}

// Fixed key order on every object built here is what makes JSON.stringify's
// output deterministic — see the ADR for why this matters for git diffs.
// Optional fields left `undefined` are dropped by JSON.stringify, so nodes
// without a size/rotation/icons set don't grow noisy keys in the saved file.
export function serializeDiagram(diagram: DiagramFile): string {
  // Edge direction sets (ADR 0081): the registry + active pointer are
  // written from the first set (a single set names the current reading and
  // adds a legend row). Per-edge `directionSets` records are only written
  // at 2+ sets — with one set an edge's direction is just its own
  // source/target/handles.
  const hasDirectionSets = !!diagram.edgeDirectionSets && diagram.edgeDirectionSets.length >= 1
  const hasMultipleDirectionSets =
    !!diagram.edgeDirectionSets && diagram.edgeDirectionSets.length >= 2
  const ordered: DiagramFile = {
    version: diagram.version,
    savedWith: diagram.savedWith,
    metadata:
      diagram.metadata && Object.keys(diagram.metadata).length > 0
        ? (sortKeysDeep(diagram.metadata) as Record<string, JsonValue>)
        : undefined,
    requiredTags:
      diagram.requiredTags && diagram.requiredTags.length > 0 ? diagram.requiredTags : undefined,
    highlights:
      diagram.highlights && diagram.highlights.length > 0 ? diagram.highlights : undefined,
    legend: diagram.legend && diagram.legend.length > 0 ? diagram.legend : undefined,
    gravityPresets:
      diagram.gravityPresets && diagram.gravityPresets.length > 0
        ? diagram.gravityPresets
        : undefined,
    maxConnectionPointsPerSide: diagram.maxConnectionPointsPerSide,
    fontFamily: diagram.fontFamily || undefined,
    edgeDirectionSets: hasDirectionSets
      ? diagram.edgeDirectionSets!.map((s) => ({
          id: s.id,
          name: s.name,
          style: sortedDirectionSetStyle(s)
        }))
      : undefined,
    activeEdgeDirectionSetId: hasDirectionSets ? diagram.activeEdgeDirectionSetId : undefined,
    security: orderedDiagramSecurity(diagram.security),
    nodes: diagram.nodes.map((n) => ({
      id: n.id,
      type: n.type,
      position: { x: n.position.x, y: n.position.y },
      size: n.size ? { width: n.size.width, height: n.size.height } : undefined,
      rotation: n.rotation,
      zIndex: n.zIndex,
      connectionPoints:
        n.connectionPoints && n.connectionPoints.length > 0 ? n.connectionPoints : undefined,
      parentId: n.parentId,
      locked: n.locked,
      style: n.style,
      metadata: sortedMetadata(n.metadata),
      data: {
        label: n.data.label,
        icons: n.data.icons && Object.keys(n.data.icons).length > 0 ? n.data.icons : undefined,
        details: n.data.details,
        linkedDiagram: n.data.linkedDiagram,
        points: n.data.points && n.data.points.length > 0 ? n.data.points : undefined,
        // NB: `references` was missing here until 2026-09-01 — a 5th
        // instance of the serialize-picklist gap (see known-issues.md),
        // found while adding `security`. Both added together.
        references:
          n.data.references && n.data.references.length > 0 ? n.data.references : undefined,
        security: sortedNodeSecurity(n.data.security, n.type)
      }
    })),
    edges: diagram.edges.map((e) => ({
      id: e.id,
      type: e.type,
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle,
      targetHandle: e.targetHandle,
      label: e.label,
      style: e.style,
      metadata: sortedMetadata(e.metadata),
      points: e.points && e.points.length > 0 ? e.points : undefined,
      directionSets: sortedDirectionSets(e.directionSets, hasMultipleDirectionSets)
    }))
  }
  return JSON.stringify(ordered, null, 2) + '\n'
}
