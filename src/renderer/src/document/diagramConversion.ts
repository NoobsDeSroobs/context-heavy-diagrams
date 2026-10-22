import type { Edge, Node } from '@xyflow/react'
import type {
  ConnectionPoint,
  DiagramFile,
  DiagramSecurity,
  EdgeDirection,
  EdgeDirectionSet,
  EdgeStyle,
  GravityPreset,
  HighlightDefinition,
  IconRef,
  IconSlot,
  JsonValue,
  LegendEntry,
  LinePoint,
  MetadataEntry,
  NodeStyle,
  RequiredTagDefinition,
  RiskCell
} from '@shared/diagram'
import {
  ensureDirectionSets,
  migrateDirectionSetStyle,
  refreshActiveDirectionSet,
  switchActiveDirectionSet
} from '../edges/edgeDirectionSets'
import { applyZIndexBackfill, nodeMetadataEligible } from '../canvas/nodeFields'
import { sortNodesForHierarchy, healHierarchy } from '../canvas/hierarchy'

export function toDiagramFile(
  nodes: Node[],
  edges: Edge[],
  metadata: Record<string, JsonValue>,
  requiredTags: RequiredTagDefinition[],
  highlights: HighlightDefinition[],
  legend: LegendEntry[],
  gravityPresets: GravityPreset[],
  maxConnectionPointsPerSide: number | undefined,
  edgeDirectionSets: EdgeDirectionSet[],
  activeEdgeDirectionSetId: string | undefined,
  security: DiagramSecurity
): DiagramFile {
  // Edge direction sets (ADR 0081): on disk, every edge is stored in the
  // *base* (first) set's orientation regardless of which set is active, so
  // switching the displayed reading never churns the edges in git. Refresh
  // the active set's per-edge records from the live fields, then — if a
  // non-base set is active — re-express the edges in base orientation for
  // serialization.
  let outEdges = edges
  if (edgeDirectionSets.length >= 2) {
    const setIds = edgeDirectionSets.map((s) => s.id)
    const baseId = edgeDirectionSets[0].id
    const activeId = activeEdgeDirectionSetId ?? baseId
    outEdges =
      activeId === baseId
        ? refreshActiveDirectionSet(edges, setIds, baseId)
        : switchActiveDirectionSet(
            edges,
            setIds,
            activeId,
            baseId,
            new Map(nodes.map((n) => [n.id, n]))
          )
  }
  return {
    version: 1,
    metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
    highlights: highlights.length > 0 ? highlights : undefined,
    legend: legend.length > 0 ? legend : undefined,
    gravityPresets: gravityPresets.length > 0 ? gravityPresets : undefined,
    maxConnectionPointsPerSide,
    // serializeDiagram drops these below 2 sets — pass them through as-is.
    edgeDirectionSets: edgeDirectionSets.length > 0 ? edgeDirectionSets : undefined,
    activeEdgeDirectionSetId,
    // serializeDiagram drops this when it carries nothing.
    security:
      security.threats.length > 0 || security.matrixEntityIds.length > 0 ? security : undefined,
    requiredTags: requiredTags.length > 0 ? requiredTags : undefined,
    nodes: nodes.map((n) => ({
      id: n.id,
      type: n.type,
      position: { x: n.position.x, y: n.position.y },
      size: n.width != null && n.height != null ? { width: n.width, height: n.height } : undefined,
      rotation: typeof n.data?.rotation === 'number' ? (n.data.rotation as number) : undefined,
      zIndex: typeof n.data?.zIndex === 'number' ? (n.data.zIndex as number) : undefined,
      connectionPoints: Array.isArray(n.data?.connectionPoints)
        ? (n.data.connectionPoints as ConnectionPoint[])
        : undefined,
      parentId: n.parentId,
      locked: n.data?.locked === true ? true : undefined,
      style: n.data?.style as NodeStyle | undefined,
      metadata: nodeMetadataEligible(n.type)
        ? (n.data?.metadata as Record<string, MetadataEntry> | undefined)
        : undefined,
      data: {
        label: String(n.data?.label ?? ''),
        icons: n.data?.icons as Partial<Record<IconSlot, IconRef>> | undefined,
        details: typeof n.data?.details === 'string' ? (n.data.details as string) : undefined,
        linkedDiagram:
          typeof n.data?.linkedDiagram === 'string' ? (n.data.linkedDiagram as string) : undefined,
        points: Array.isArray(n.data?.points) ? (n.data.points as LinePoint[]) : undefined,
        references:
          Array.isArray(n.data?.references) && (n.data.references as string[]).length > 0
            ? (n.data.references as string[])
            : undefined,
        security:
          n.type === 'entity' && n.data?.security && typeof n.data.security === 'object'
            ? (n.data.security as Record<string, RiskCell>)
            : undefined
      }
    })),
    edges: outEdges.map((e) => ({
      id: e.id,
      type: e.type,
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle ?? undefined,
      targetHandle: e.targetHandle ?? undefined,
      label: typeof e.data?.label === 'string' && e.data.label ? e.data.label : undefined,
      style: e.data?.style as EdgeStyle | undefined,
      metadata: e.data?.metadata as Record<string, MetadataEntry> | undefined,
      points:
        Array.isArray(e.data?.points) && (e.data.points as LinePoint[]).length > 0
          ? (e.data.points as LinePoint[])
          : undefined,
      directionSets: e.data?.directionSets as Record<string, EdgeDirection> | undefined
    }))
  }
}

export function fromDiagramFile(diagram: DiagramFile): {
  nodes: Node[]
  edges: Edge[]
  metadata: Record<string, JsonValue>
  requiredTags: RequiredTagDefinition[]
  highlights: HighlightDefinition[]
  legend: LegendEntry[]
  gravityPresets: GravityPreset[]
  maxConnectionPointsPerSide: number | undefined
  edgeDirectionSets: EdgeDirectionSet[]
  activeEdgeDirectionSetId: string | undefined
  security: DiagramSecurity
  hierarchyNotes: string[]
} {
  // healHierarchy repairs a dangling/cyclic parentId before the nodes reach
  // React Flow (ADR 0075); sortNodesForHierarchy then defensively re-orders in
  // case an external writer didn't honor the parent-before-child requirement
  // (see docs/file-format.md's parentId entry). applyZIndexBackfill runs on
  // that *final* order, not the raw file order, so "array position" means the
  // same thing it does for today's actual rendering — see ADR 0035.
  const healed = healHierarchy(
    diagram.nodes.map((n) => ({
      id: n.id,
      type: n.type,
      position: n.position,
      width: n.size?.width,
      height: n.size?.height,
      ...(n.parentId ? { parentId: n.parentId } : {}),
      data: {
        label: n.data.label,
        ...(n.rotation != null ? { rotation: n.rotation } : {}),
        ...(n.zIndex != null ? { zIndex: n.zIndex } : {}),
        ...(n.locked ? { locked: true } : {}),
        ...(n.connectionPoints && n.connectionPoints.length > 0
          ? { connectionPoints: n.connectionPoints }
          : {}),
        ...(n.data.icons ? { icons: n.data.icons } : {}),
        ...(n.data.details ? { details: n.data.details } : {}),
        ...(n.data.linkedDiagram ? { linkedDiagram: n.data.linkedDiagram } : {}),
        ...(n.data.points && n.data.points.length > 0 ? { points: n.data.points } : {}),
        ...(Array.isArray(n.data.references) && n.data.references.length > 0
          ? { references: n.data.references }
          : {}),
        ...(n.type === 'entity' && n.data.security && Object.keys(n.data.security).length > 0
          ? { security: n.data.security }
          : {}),
        ...(n.style ? { style: n.style } : {}),
        ...(n.metadata && nodeMetadataEligible(n.type) ? { metadata: n.metadata } : {})
      }
    }))
  )
  const finalNodes = applyZIndexBackfill(sortNodesForHierarchy(healed.nodes))

  // Edge direction sets (ADR 0081). The file's edges are in base ([0])
  // orientation with per-set records in `directionSets`. Seed any missing
  // record from the live (base) fields, then — if a non-base set is the
  // saved active one — re-express the live edges in that set's orientation.
  // migrateDirectionSetStyle: pre-ADR-0083 `legend` -> `style` (ADR 0083).
  const directionSets = (diagram.edgeDirectionSets ?? []).map(migrateDirectionSetStyle)
  let edges: Edge[] = diagram.edges.map((e) => ({
    id: e.id,
    // Conditional, not `type: e.type`: an explicit `type: undefined` survives React Flow's `{
    // ...defaultEdgeOptions, ...edge }` merge (EdgeWrapper) and overwrites defaultEdgeOptions.type,
    // silently routing the edge to RF's built-in component instead of LabeledEdge, with no error.
    // Hand-authored files that omit `type` (docs/file-format.md: absent means default) hit this.
    ...(e.type ? { type: e.type } : {}),
    source: e.source,
    target: e.target,
    sourceHandle: e.sourceHandle,
    targetHandle: e.targetHandle,
    data: {
      label: e.label ?? '',
      ...(e.style ? { style: e.style } : {}),
      ...(e.metadata ? { metadata: e.metadata } : {}),
      ...(e.points && e.points.length > 0 ? { points: e.points } : {}),
      ...(e.directionSets && Object.keys(e.directionSets).length > 0
        ? { directionSets: e.directionSets }
        : {})
    }
  }))
  let activeEdgeDirectionSetId: string | undefined
  if (directionSets.length >= 1) {
    const setIds = directionSets.map((s) => s.id)
    const baseId = setIds[0]
    activeEdgeDirectionSetId =
      diagram.activeEdgeDirectionSetId && setIds.includes(diagram.activeEdgeDirectionSetId)
        ? diagram.activeEdgeDirectionSetId
        : baseId
    // Per-edge records + base-orientation only matter at 2+ sets.
    if (directionSets.length >= 2) {
      edges = ensureDirectionSets(edges, setIds)
      if (activeEdgeDirectionSetId !== baseId) {
        edges = switchActiveDirectionSet(
          edges,
          setIds,
          baseId,
          activeEdgeDirectionSetId,
          new Map(finalNodes.map((n) => [n.id, n]))
        )
      }
    }
  }

  // Security model (ADR 0082) — prune references that no longer resolve
  // (entity deleted from the canvas) and strip orphan per-entity cells
  // (threat since removed from the catalog, or entity no longer a matrix
  // member — e.g. resurrected by an undo across a remove). One Diagnostics
  // note if anything changed. Same self-cleaning stance as recentDiagrams.
  const securityNotes: string[] = []
  let security: DiagramSecurity = { threats: [], matrixEntityIds: [] }
  let securedNodes = finalNodes
  const src = diagram.security
  if (src && (src.threats.length > 0 || src.matrixEntityIds.length > 0)) {
    const entityIds = new Set(finalNodes.filter((n) => n.type === 'entity').map((n) => n.id))
    const threatIds = new Set(src.threats.map((t) => t.id))
    const matrixEntityIds = src.matrixEntityIds.filter((id) => entityIds.has(id))
    const matrixSet = new Set(matrixEntityIds)
    const droppedEntities = src.matrixEntityIds.length - matrixEntityIds.length
    security = {
      threats: src.threats,
      hiddenThreatIds: src.hiddenThreatIds?.filter((id) => threatIds.has(id)),
      matrixEntityIds,
      hiddenEntityIds: src.hiddenEntityIds?.filter((id) => matrixSet.has(id)),
      probabilityScale: src.probabilityScale,
      consequenceScale: src.consequenceScale
      // combineMethod / aggregateMethod: session-only, ignored on read (ADR 0088)
    }
    let droppedCells = 0
    securedNodes = finalNodes.map((n) => {
      const cells = n.data?.security as Record<string, RiskCell> | undefined
      if (!cells) return n
      const keep =
        n.type === 'entity' && matrixSet.has(n.id)
          ? Object.fromEntries(Object.entries(cells).filter(([tid]) => threatIds.has(tid)))
          : {}
      const removed = Object.keys(cells).length - Object.keys(keep).length
      if (removed === 0) return n
      droppedCells += removed
      const nextData = { ...n.data }
      if (Object.keys(keep).length > 0) nextData.security = keep
      else delete nextData.security
      return { ...n, data: nextData }
    })
    if (droppedEntities > 0) {
      securityNotes.push(
        `Security matrix: ${droppedEntities} entity reference(s) dropped — the entity no longer exists.`
      )
    }
    if (droppedCells > 0) {
      securityNotes.push(
        `Security matrix: ${droppedCells} orphan assessment(s) dropped — the threat was removed, or the entity isn't in the matrix.`
      )
    }
  }

  return {
    highlights: diagram.highlights ?? [],
    legend: diagram.legend ?? [],
    gravityPresets: diagram.gravityPresets ?? [],
    maxConnectionPointsPerSide: diagram.maxConnectionPointsPerSide,
    edgeDirectionSets: directionSets.length >= 1 ? directionSets : [],
    activeEdgeDirectionSetId,
    security,
    hierarchyNotes: [...healed.notes, ...securityNotes],
    nodes: securedNodes,
    edges,
    metadata: diagram.metadata ?? {},
    requiredTags: diagram.requiredTags ?? []
  }
}
