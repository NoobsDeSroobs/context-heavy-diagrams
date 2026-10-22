import type { Edge, Node } from '@xyflow/react'
import type { MetadataEntry, RequiredTagDefinition } from '@shared/diagram'
import { nodeMetadataEligible } from '../canvas/nodeFields'
import { syncElementMetadata } from './metadataSync'

// Reconciles every eligible node's / edge's metadata against the diagram's required-tags template
// (syncElementMetadata has the rules). One message per correction is pushed onto `notices`.
export function syncNodeMetadata(
  nodes: Node[],
  tags: RequiredTagDefinition[],
  notices: string[]
): Node[] {
  return nodes.map((n) => {
    if (!nodeMetadataEligible(n.type)) return n
    const label = `${n.type === 'entity' ? 'Entity' : 'Container'} "${String(n.data?.label ?? n.id)}"`
    const metadata = syncElementMetadata(
      n.data?.metadata as Record<string, MetadataEntry> | undefined,
      tags,
      label,
      notices
    )
    return { ...n, data: { ...n.data, metadata } }
  })
}

export function syncEdgeMetadata(
  edges: Edge[],
  tags: RequiredTagDefinition[],
  notices: string[]
): Edge[] {
  return edges.map((e) => {
    const label = `Edge "${(typeof e.data?.label === 'string' && e.data.label) || e.id}"`
    const metadata = syncElementMetadata(
      e.data?.metadata as Record<string, MetadataEntry> | undefined,
      tags,
      label,
      notices
    )
    return { ...e, data: { ...e.data, metadata } }
  })
}
