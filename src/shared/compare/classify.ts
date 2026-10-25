// Spike for the compare window: classifies every node and edge of two versions of a diagram
// into the review colours, and builds the merged diagram the window draws (the later
// elements plus a ghost of each removed one). No I/O; the caller supplies both sides.

import type { DiagramEdge, DiagramFile, DiagramNode } from '../diagram'
import { EDGE_FIELDS, NODE_FIELDS, diffFields } from '../document/changesSinceSave.ts'

// green / red / orange (a link or a Details file) / yellow (what the element says or connects to)
export type CompareStatus = 'added' | 'removed' | 'links' | 'content'

export interface ElementChange {
  status: CompareStatus
  // Human-readable names of the fields behind the status, for the hover card.
  fields: string[]
}

// Fields that only move or restyle an element: not tracked, the element stays dimmed.
const LAYOUT_ONLY = new Set([
  'position',
  'size',
  'rotation',
  'layer order',
  'locked',
  'style',
  'icons',
  'points'
])

// A path or a file reference: easy to miss, often important context.
const LINK_FIELDS = new Set(['details link', 'linked diagram', 'reference images'])

function classifyFields(fields: string[]): ElementChange | null {
  const tracked = fields.filter((f) => !LAYOUT_ONLY.has(f))
  if (tracked.length === 0) return null
  return { status: tracked.some((f) => LINK_FIELDS.has(f)) ? 'links' : 'content', fields: tracked }
}

export interface Classification {
  nodes: Map<string, ElementChange>
  edges: Map<string, ElementChange>
  // The later diagram plus the removed elements, in their old state.
  merged: DiagramFile
}

function classifyElements<T extends { id: string }>(
  base: T[],
  next: T[],
  specs: Parameters<typeof diffFields<T>>[0]
): { changes: Map<string, ElementChange>; removed: T[] } {
  const changes = new Map<string, ElementChange>()
  const baseById = new Map(base.map((el) => [el.id, el]))
  const nextIds = new Set(next.map((el) => el.id))
  for (const el of next) {
    const prior = baseById.get(el.id)
    if (!prior) {
      changes.set(el.id, { status: 'added', fields: [] })
      continue
    }
    const change = classifyFields(diffFields(specs, prior, el))
    if (change) changes.set(el.id, change)
  }
  const removed = base.filter((el) => !nextIds.has(el.id))
  for (const el of removed) changes.set(el.id, { status: 'removed', fields: [] })
  return { changes, removed }
}

export function classifyDiagrams(base: DiagramFile, next: DiagramFile): Classification {
  const nodes = classifyElements<DiagramNode>(base.nodes, next.nodes, NODE_FIELDS)
  const edges = classifyElements<DiagramEdge>(base.edges, next.edges, EDGE_FIELDS)
  return {
    nodes: nodes.changes,
    edges: edges.changes,
    merged: {
      ...next,
      nodes: [...next.nodes, ...nodes.removed],
      edges: [...next.edges, ...edges.removed]
    }
  }
}
