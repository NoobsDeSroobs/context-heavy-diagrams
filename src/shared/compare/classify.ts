// Compares two versions of a diagram for review: puts every node and edge in one of the review
// colours, says what changed in words, lists the diagram-level changes the canvas cannot colour,
// and builds the diagram the compare window draws (the later version, a ghost of each removed
// element, every edge drawable). No I/O; the caller supplies both versions.

import type { DiagramEdge, DiagramFile, DiagramNode } from '../diagram'
import { deepEqual } from '../document/changesSinceSave.ts'
import { diffCollections, type CollectionChange } from './collections.ts'
import { makeEdgesDrawable } from './drawable.ts'
import {
  EDGE_FIELDS,
  NODE_FIELDS,
  type DescribeContext,
  type FieldSpec,
  type Side
} from './fields.ts'

// green / red / orange (a link or a Details file) / yellow (what the element says or connects to)
export type CompareStatus = 'added' | 'removed' | 'links' | 'content'

export interface FieldChange {
  field: string
  link: boolean
  // What changed, as lines for the hover card.
  lines: string[]
  before: unknown
  after: unknown
}

export interface ElementChange {
  status: CompareStatus
  fields: FieldChange[]
  // A change to a security assessment: reviewed first.
  security: boolean
}

export type ElementKind = 'node' | 'edge'

export interface ReviewItem {
  kind: ElementKind
  id: string
  label: string
  change: ElementChange
}

// What happened to an element's Details file, which only the caller can read.
export type DetailsContentChange = 'changed' | 'added' | 'removed'

export interface CompareOptions {
  detailsContent?: ReadonlyMap<string, DetailsContentChange>
}

export interface Classification {
  nodes: Map<string, ElementChange>
  edges: Map<string, ElementChange>
  // Every changed element, most important first: security, links, content, removed, added.
  review: ReviewItem[]
  counts: Record<CompareStatus, number>
  diagramLevel: CollectionChange[]
  // The later version plus the removed elements in their old state, exactly as the files say.
  merged: DiagramFile
  // `merged` with every edge made drawable, for the window.
  view: DiagramFile
  // Edges whose connection point was missing and was moved in `view`.
  repairedEdges: Set<string>
  // Edges whose end node does not exist: cannot be drawn.
  danglingEdges: string[]
}

function firstLine(text: string): string {
  return text.split('\n')[0].trim()
}

function contextFor(base: DiagramFile, next: DiagramFile): DescribeContext {
  const nodes = {
    before: new Map(base.nodes.map((n) => [n.id, n.data.label])),
    after: new Map(next.nodes.map((n) => [n.id, n.data.label]))
  }
  const threats = {
    before: new Map((base.security?.threats ?? []).map((t) => [t.id, t.name])),
    after: new Map((next.security?.threats ?? []).map((t) => [t.id, t.name]))
  }
  return {
    nodeLabel: (side: Side, id) => firstLine(nodes[side].get(id) ?? '') || id,
    threatName: (side: Side, id) => threats[side].get(id) ?? id
  }
}

function fieldChanges<T>(
  specs: FieldSpec<T>[],
  before: T,
  after: T,
  ctx: DescribeContext
): FieldChange[] {
  const changes: FieldChange[] = []
  for (const spec of specs) {
    if (spec.category === 'layout') continue
    const was = spec.get(before)
    const now = spec.get(after)
    if (deepEqual(was, now)) continue
    const lines = spec.describe?.(was, now, ctx) ?? []
    changes.push({
      field: spec.name,
      link: spec.category === 'link',
      lines: lines.length > 0 ? lines : [`${spec.name} changed`],
      before: was,
      after: now
    })
  }
  return changes
}

function statusOf(fields: FieldChange[]): ElementChange | null {
  if (fields.length === 0) return null
  return {
    status: fields.some((f) => f.link) ? 'links' : 'content',
    fields,
    security: fields.some((f) => f.field === 'security')
  }
}

function classifyElements<T extends { id: string }>(
  base: T[],
  next: T[],
  specs: FieldSpec<T>[],
  ctx: DescribeContext,
  extra?: (id: string) => FieldChange | undefined
): { changes: Map<string, ElementChange>; removed: T[] } {
  const changes = new Map<string, ElementChange>()
  const baseById = new Map(base.map((el) => [el.id, el]))
  const nextIds = new Set(next.map((el) => el.id))
  for (const el of next) {
    const prior = baseById.get(el.id)
    if (!prior) {
      changes.set(el.id, { status: 'added', fields: [], security: false })
      continue
    }
    const fields = fieldChanges(specs, prior, el, ctx)
    const more = extra?.(el.id)
    if (more) fields.push(more)
    const change = statusOf(fields)
    if (change) changes.set(el.id, change)
  }
  const removed = base.filter((el) => !nextIds.has(el.id))
  for (const el of removed) changes.set(el.id, { status: 'removed', fields: [], security: false })
  return { changes, removed }
}

function rank(change: ElementChange): number {
  if (change.security) return 0
  return { links: 1, content: 2, removed: 3, added: 4 }[change.status]
}

function nodeLabel(n: DiagramNode): string {
  return firstLine(n.data.label) || '(unlabeled)'
}

export function classifyDiagrams(
  base: DiagramFile,
  next: DiagramFile,
  options: CompareOptions = {}
): Classification {
  const ctx = contextFor(base, next)
  const detailsField = (id: string): FieldChange | undefined => {
    const state = options.detailsContent?.get(id)
    if (!state) return undefined
    return {
      field: 'Details file content',
      link: true,
      lines: [`Details file: ${state === 'changed' ? 'content changed' : state}`],
      before: undefined,
      after: undefined
    }
  }
  const nodes = classifyElements<DiagramNode>(
    base.nodes,
    next.nodes,
    NODE_FIELDS,
    ctx,
    detailsField
  )
  const edges = classifyElements<DiagramEdge>(base.edges, next.edges, EDGE_FIELDS, ctx)

  const merged: DiagramFile = {
    ...next,
    nodes: [...next.nodes, ...nodes.removed],
    edges: [...next.edges, ...edges.removed]
  }
  const drawable = makeEdgesDrawable(merged)

  const labels = new Map(merged.nodes.map((n) => [n.id, nodeLabel(n)]))
  const edgeLabel = (e: DiagramEdge): string =>
    e.label?.trim() || `${labels.get(e.source) ?? e.source} → ${labels.get(e.target) ?? e.target}`
  const review: ReviewItem[] = [
    ...merged.nodes.flatMap((n) => {
      const change = nodes.changes.get(n.id)
      return change ? [{ kind: 'node' as const, id: n.id, label: nodeLabel(n), change }] : []
    }),
    ...merged.edges.flatMap((e) => {
      const change = edges.changes.get(e.id)
      return change ? [{ kind: 'edge' as const, id: e.id, label: edgeLabel(e), change }] : []
    })
  ].sort((a, b) => rank(a.change) - rank(b.change))

  const counts: Record<CompareStatus, number> = { added: 0, removed: 0, links: 0, content: 0 }
  for (const item of review) counts[item.change.status] += 1

  return {
    nodes: nodes.changes,
    edges: edges.changes,
    review,
    counts,
    diagramLevel: diffCollections(base, next),
    merged,
    view: drawable.diagram,
    repairedEdges: drawable.repaired,
    danglingEdges: drawable.dangling
  }
}
