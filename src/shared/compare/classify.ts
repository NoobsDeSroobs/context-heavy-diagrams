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

export interface DetailsContent {
  state: DetailsContentChange
  // A few lines of what changed, for the hover card (textPreview.ts).
  preview: string[]
}

export interface ElementCount {
  nodes: number
  edges: number
}

// "1 element, 4 connections"; "0" when there are none.
export function describeCount(count: ElementCount): string {
  const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`
  const parts = [
    count.nodes > 0 && plural(count.nodes, 'element', 'elements'),
    count.edges > 0 && plural(count.edges, 'connection', 'connections')
  ].filter(Boolean)
  return parts.length > 0 ? parts.join(', ') : '0'
}

export interface CompareOptions {
  detailsContent?: ReadonlyMap<string, DetailsContent>
}

export interface Classification {
  nodes: Map<string, ElementChange>
  edges: Map<string, ElementChange>
  // Every changed element, most important first: security, links, content, removed, added.
  review: ReviewItem[]
  // Per colour, elements and connections apart: deleting one entity also removes its edges, and
  // "5 removed" would read as five things gone.
  counts: Record<CompareStatus, ElementCount>
  // Elements present in both versions whose own look changed (fill, border, font, icons), whatever
  // else changed. Not a colour: the window marks them with a paint brush, if asked to.
  restyledNodes: Set<string>
  restyledEdges: Set<string>
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

// The look-only fields: what a restyle changes. Position, size and the rest stay untracked.
const LOOK_FIELDS = new Set(['style', 'icons'])

function restyled<T extends { id: string }>(
  base: T[],
  next: T[],
  specs: FieldSpec<T>[]
): Set<string> {
  const looks = specs.filter((s) => LOOK_FIELDS.has(s.name))
  const baseById = new Map(base.map((el) => [el.id, el]))
  const ids = new Set<string>()
  for (const el of next) {
    const prior = baseById.get(el.id)
    if (prior && looks.some((s) => !deepEqual(s.get(prior), s.get(el)))) ids.add(el.id)
  }
  return ids
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
    const content = options.detailsContent?.get(id)
    if (!content) return undefined
    return {
      field: 'Details file content',
      link: true,
      lines: [
        `Details file: ${content.state === 'changed' ? 'content changed' : content.state}`,
        ...content.preview
      ],
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

  const empty = (): ElementCount => ({ nodes: 0, edges: 0 })
  const counts: Record<CompareStatus, ElementCount> = {
    added: empty(),
    removed: empty(),
    links: empty(),
    content: empty()
  }
  for (const item of review)
    counts[item.change.status][item.kind === 'node' ? 'nodes' : 'edges'] += 1

  return {
    nodes: nodes.changes,
    edges: edges.changes,
    review,
    counts,
    restyledNodes: restyled(base.nodes, next.nodes, NODE_FIELDS),
    restyledEdges: restyled(base.edges, next.edges, EDGE_FIELDS),
    diagramLevel: diffCollections(base, next),
    merged,
    view: drawable.diagram,
    repairedEdges: drawable.repaired,
    danglingEdges: drawable.dangling
  }
}
