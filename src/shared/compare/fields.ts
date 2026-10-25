// The fields of a node and an edge that a comparison looks at: which review colour a change to
// each one earns, and how a change reads in the hover card. Layout-only fields are listed so the
// engine says on purpose that it does not track them.

import type { DiagramEdge, DiagramNode, MetadataEntry, RiskCell } from '../diagram'

// 'link' is a path or file reference (orange); 'content' is what an element says or connects to
// (yellow); 'layout' only moves or restyles it (not tracked, the element stays dimmed).
export type FieldCategory = 'link' | 'content' | 'layout'

export type Side = 'before' | 'after'

// Names for ids that appear in a field's value, looked up in the version the value came from.
export interface DescribeContext {
  nodeLabel: (side: Side, id: string) => string
  threatName: (side: Side, id: string) => string
}

export interface FieldSpec<T> {
  name: string
  category: FieldCategory
  get: (el: T) => unknown
  // Lines for the hover card; absent means just "<name> changed".
  describe?: (before: unknown, after: unknown, ctx: DescribeContext) => string[]
}

const MAX_TEXT = 60

function clip(text: string): string {
  return text.length > MAX_TEXT ? `${text.slice(0, MAX_TEXT - 1)}…` : text
}

function quoted(text: string): string {
  return `"${clip(text.split('\n')[0].trim())}"`
}

function show(value: unknown): string {
  if (value === undefined || value === null) return '(none)'
  return typeof value === 'string' ? quoted(value) : clip(JSON.stringify(value))
}

function change(name: string, before: unknown, after: unknown): string[] {
  return [`${name}: ${show(before)} → ${show(after)}`]
}

// A path that was added, replaced or removed.
function describePath(name: string) {
  return (before: unknown, after: unknown): string[] => {
    if (before === undefined) return [`${name}: added ${show(after)}`]
    if (after === undefined) return [`${name}: removed (was ${show(before)})`]
    return change(name, before, after)
  }
}

function describeTags(before: unknown, after: unknown): string[] {
  const was = (before ?? {}) as Record<string, MetadataEntry>
  const now = (after ?? {}) as Record<string, MetadataEntry>
  const lines: string[] = []
  for (const key of Object.keys(now).sort()) {
    if (!(key in was)) lines.push(`+ ${key}: ${show(now[key].value)}`)
    else if (JSON.stringify(was[key]) !== JSON.stringify(now[key])) {
      const lock = was[key].lock !== now[key].lock ? ' (lock changed)' : ''
      lines.push(
        JSON.stringify(was[key].value) === JSON.stringify(now[key].value)
          ? `~ ${key}: lock changed`
          : `~ ${key}: ${show(was[key].value)} → ${show(now[key].value)}${lock}`
      )
    }
  }
  for (const key of Object.keys(was).sort()) {
    if (!(key in now)) lines.push(`− ${key}: ${show(was[key].value)}`)
  }
  return lines
}

function cell(c: RiskCell): string {
  return `probability ${c.probability}, consequence ${c.consequence}`
}

function describeSecurity(before: unknown, after: unknown, ctx: DescribeContext): string[] {
  const was = (before ?? {}) as Record<string, RiskCell>
  const now = (after ?? {}) as Record<string, RiskCell>
  const lines: string[] = []
  for (const id of Object.keys(now)) {
    if (!(id in was)) lines.push(`+ ${ctx.threatName('after', id)}: ${cell(now[id])}`)
    else if (JSON.stringify(was[id]) !== JSON.stringify(now[id])) {
      lines.push(`~ ${ctx.threatName('after', id)}: ${cell(was[id])} → ${cell(now[id])}`)
    }
  }
  for (const id of Object.keys(was)) {
    if (!(id in now)) lines.push(`− ${ctx.threatName('before', id)}: ${cell(was[id])}`)
  }
  return lines
}

function describeList(name: string) {
  return (before: unknown, after: unknown): string[] => {
    const was = (before ?? []) as string[]
    const now = (after ?? []) as string[]
    return [
      ...now.filter((p) => !was.includes(p)).map((p) => `${name}: added ${show(p)}`),
      ...was.filter((p) => !now.includes(p)).map((p) => `${name}: removed ${show(p)}`)
    ]
  }
}

// An id in a value, named by the version it came from; a missing id keeps its raw form.
function describeNodeRef(name: string) {
  return (before: unknown, after: unknown, ctx: DescribeContext): string[] => {
    const named = (side: Side, id: unknown): string =>
      typeof id === 'string' ? quoted(ctx.nodeLabel(side, id)) : '(none)'
    return [`${name}: ${named('before', before)} → ${named('after', after)}`]
  }
}

function count(value: unknown): number {
  return Array.isArray(value) ? value.length : 0
}

export const NODE_FIELDS: FieldSpec<DiagramNode>[] = [
  {
    name: 'type',
    category: 'content',
    get: (n) => n.type,
    describe: (b, a) => change('type', b ?? 'entity', a ?? 'entity')
  },
  { name: 'position', category: 'layout', get: (n) => n.position },
  { name: 'size', category: 'layout', get: (n) => n.size },
  { name: 'rotation', category: 'layout', get: (n) => n.rotation },
  { name: 'layer order', category: 'layout', get: (n) => n.zIndex },
  {
    name: 'connection points',
    category: 'content',
    get: (n) => n.connectionPoints,
    describe: (b, a) => [`connection points: ${count(b)} stored → ${count(a)} stored`]
  },
  {
    name: 'parent',
    category: 'content',
    get: (n) => n.parentId,
    describe: describeNodeRef('container')
  },
  { name: 'locked', category: 'layout', get: (n) => n.locked },
  { name: 'style', category: 'layout', get: (n) => n.style },
  { name: 'tags', category: 'content', get: (n) => n.metadata, describe: describeTags },
  {
    name: 'label',
    category: 'content',
    get: (n) => n.data.label,
    describe: (b, a) => change('label', b, a)
  },
  { name: 'icons', category: 'layout', get: (n) => n.data.icons },
  {
    name: 'details link',
    category: 'link',
    get: (n) => n.data.details,
    describe: describePath('Details file')
  },
  {
    name: 'linked diagram',
    category: 'link',
    get: (n) => n.data.linkedDiagram,
    describe: describePath('linked diagram')
  },
  { name: 'points', category: 'layout', get: (n) => n.data.points },
  {
    name: 'reference images',
    category: 'link',
    get: (n) => n.data.references,
    describe: describeList('reference image')
  },
  { name: 'security', category: 'content', get: (n) => n.data.security, describe: describeSecurity }
]

export const EDGE_FIELDS: FieldSpec<DiagramEdge>[] = [
  { name: 'type', category: 'layout', get: (e) => e.type },
  { name: 'source', category: 'content', get: (e) => e.source, describe: describeNodeRef('from') },
  { name: 'target', category: 'content', get: (e) => e.target, describe: describeNodeRef('to') },
  {
    name: 'source connection point',
    category: 'content',
    get: (e) => e.sourceHandle,
    describe: (b, a) => change('leaves from point', b, a)
  },
  {
    name: 'target connection point',
    category: 'content',
    get: (e) => e.targetHandle,
    describe: (b, a) => change('arrives at point', b, a)
  },
  {
    name: 'label',
    category: 'content',
    get: (e) => e.label,
    describe: (b, a) => change('label', b, a)
  },
  { name: 'style', category: 'layout', get: (e) => e.style },
  { name: 'tags', category: 'content', get: (e) => e.metadata, describe: describeTags },
  {
    name: 'direction sets',
    category: 'content',
    get: (e) => e.directionSets,
    describe: (b, a) => {
      const was = (b ?? {}) as Record<string, unknown>
      const now = (a ?? {}) as Record<string, unknown>
      const ids = new Set([...Object.keys(was), ...Object.keys(now)])
      const differing = [...ids].filter((id) => JSON.stringify(was[id]) !== JSON.stringify(now[id]))
      return [
        `direction sets: ${differing.length} reading${differing.length === 1 ? '' : 's'} changed`
      ]
    }
  },
  { name: 'points', category: 'layout', get: (e) => e.points }
]
