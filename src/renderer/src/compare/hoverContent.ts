import type { Edge, Node } from '@xyflow/react'
import type { Classification } from '@shared/compare/classify'
import { STATUS_LABEL } from '@shared/compare/format'

export interface HoverCardContent {
  edge: boolean
  title: string
  status: string
  lines: string[]
}

// The later ids of elements the reviewer asked to be matched with an earlier one (see match.ts).
export interface MatchedIds {
  nodes: ReadonlySet<string>
  edges: ReadonlySet<string>
}

function labelOf(nodes: Node[], id: string | undefined): string {
  const label = String(nodes.find((n) => n.id === id)?.data?.label ?? '').split('\n')[0]
  return label || id || '?'
}

// What the hover card says about the node or edge under the pointer.
export function describeHover(
  c: Classification,
  id: string,
  nodes: Node[],
  edges: Edge[],
  matched: MatchedIds
): HoverCardContent | null {
  const node = nodes.find((n) => n.id === id)
  const edge = node ? undefined : edges.find((e) => e.id === id)
  if (!node && !edge) return null
  const change = node ? c.nodes.get(id) : c.edges.get(id)
  const lines = (change?.fields ?? []).flatMap((f) => f.lines)
  if (node ? matched.nodes.has(id) : matched.edges.has(id)) {
    lines.push('id differs from the earlier version; matched by name and place (a guess)')
  }
  if (node ? c.restyledNodes.has(id) : c.restyledEdges.has(id))
    lines.push('restyled (look changed)')
  if (edge && c.repairedEdges.has(id)) {
    lines.push('names a connection point its node lacks; drawn to the nearest one')
  }
  const nodeTitle = String(node?.data?.label ?? '').split('\n')[0]
  const title = node
    ? nodeTitle || '(unlabeled)'
    : String(edge?.data?.label ?? '') ||
      `${labelOf(nodes, edge?.source)} → ${labelOf(nodes, edge?.target)}`
  return {
    edge: edge !== undefined,
    title,
    status: change ? STATUS_LABEL[change.status] : 'Unchanged or only moved',
    lines
  }
}
