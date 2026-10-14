// Pure diff engine behind "changes since last save" (epic 0117, ADR 0102).
// v1 scope: nodes and edges only, by id — the 8 top-level collections
// (highlights, legend, requiredTags, gravityPresets, security catalog,
// edgeDirectionSets, metadata, maxConnectionPointsPerSide) are a deliberate
// fast-follow, not covered here. No I/O — the caller supplies both sides
// (the file on disk, and the live state via toDiagramFile()).

import type { DiagramEdge, DiagramFile, DiagramNode } from './diagram'

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false
  if (Array.isArray(a) !== Array.isArray(b)) return false
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((v, i) => deepEqual(v, b[i]))
  }
  const aRec = a as Record<string, unknown>
  const bRec = b as Record<string, unknown>
  const aKeys = Object.keys(aRec)
  const bKeys = Object.keys(bRec)
  return aKeys.length === bKeys.length && aKeys.every((k) => deepEqual(aRec[k], bRec[k]))
}

interface FieldSpec<T> {
  name: string
  get: (el: T) => unknown
}

// Human-readable names, shown in the Modified row's field list — not the
// schema's own property names, since "data.details" means nothing to a user
// deciding whether a change matters.
const NODE_FIELDS: FieldSpec<DiagramNode>[] = [
  { name: 'type', get: (n) => n.type },
  { name: 'position', get: (n) => n.position },
  { name: 'size', get: (n) => n.size },
  { name: 'rotation', get: (n) => n.rotation },
  { name: 'layer order', get: (n) => n.zIndex },
  { name: 'connection points', get: (n) => n.connectionPoints },
  { name: 'parent', get: (n) => n.parentId },
  { name: 'locked', get: (n) => n.locked },
  { name: 'style', get: (n) => n.style },
  { name: 'tags', get: (n) => n.metadata },
  { name: 'label', get: (n) => n.data.label },
  { name: 'icons', get: (n) => n.data.icons },
  { name: 'details link', get: (n) => n.data.details },
  { name: 'linked diagram', get: (n) => n.data.linkedDiagram },
  { name: 'points', get: (n) => n.data.points },
  { name: 'reference images', get: (n) => n.data.references },
  { name: 'security', get: (n) => n.data.security }
]

const EDGE_FIELDS: FieldSpec<DiagramEdge>[] = [
  { name: 'type', get: (e) => e.type },
  { name: 'source', get: (e) => e.source },
  { name: 'target', get: (e) => e.target },
  { name: 'source connection point', get: (e) => e.sourceHandle },
  { name: 'target connection point', get: (e) => e.targetHandle },
  { name: 'label', get: (e) => e.label },
  { name: 'style', get: (e) => e.style },
  { name: 'tags', get: (e) => e.metadata },
  { name: 'direction sets', get: (e) => e.directionSets },
  { name: 'points', get: (e) => e.points }
]

function diffFields<T>(specs: FieldSpec<T>[], saved: T, current: T): string[] {
  return specs.filter((s) => !deepEqual(s.get(saved), s.get(current))).map((s) => s.name)
}

export type ElementKind = 'node' | 'edge'
export type ChangeType = 'added' | 'removed' | 'modified'

export interface ChangedElement {
  kind: ElementKind
  id: string
  label: string
  changeType: ChangeType
  // Only present for 'modified' — human-readable field names that differ.
  changedFields?: string[]
}

export interface ChangesSinceSave {
  added: ChangedElement[]
  removed: ChangedElement[]
  modified: ChangedElement[]
}

export function hasChanges(diff: ChangesSinceSave): boolean {
  return diff.added.length > 0 || diff.removed.length > 0 || diff.modified.length > 0
}

// "3 modified, 1 added, 1 removed" — omits any bucket that's empty; empty
// overall means "no changes" (caller decides whether to show that at all).
export function summarizeChanges(diff: ChangesSinceSave): string {
  const parts: string[] = []
  if (diff.modified.length > 0) parts.push(`${diff.modified.length} modified`)
  if (diff.added.length > 0) parts.push(`${diff.added.length} added`)
  if (diff.removed.length > 0) parts.push(`${diff.removed.length} removed`)
  return parts.join(', ')
}

function nodeLabel(n: DiagramNode): string {
  return n.data.label || '(unlabeled)'
}

// An edge has no label of its own worth showing when unset — fall back to
// "source → target" using whichever node labels are available on that side
// of the diff (a removed edge's endpoints may no longer exist on the other
// side, hence the two separate label maps rather than one).
function edgeLabel(e: DiagramEdge, labelsById: Map<string, string>): string {
  if (e.label) return e.label
  const source = labelsById.get(e.source) ?? e.source
  const target = labelsById.get(e.target) ?? e.target
  return `${source} → ${target}`
}

export function diffDiagrams(saved: DiagramFile, current: DiagramFile): ChangesSinceSave {
  const added: ChangedElement[] = []
  const removed: ChangedElement[] = []
  const modified: ChangedElement[] = []

  const savedNodesById = new Map(saved.nodes.map((n) => [n.id, n]))
  const currentNodesById = new Map(current.nodes.map((n) => [n.id, n]))
  const savedLabelsById = new Map(saved.nodes.map((n) => [n.id, nodeLabel(n)]))
  const currentLabelsById = new Map(current.nodes.map((n) => [n.id, nodeLabel(n)]))

  for (const n of current.nodes) {
    if (!savedNodesById.has(n.id)) {
      added.push({ kind: 'node', id: n.id, label: nodeLabel(n), changeType: 'added' })
    }
  }
  for (const n of saved.nodes) {
    if (!currentNodesById.has(n.id)) {
      removed.push({ kind: 'node', id: n.id, label: nodeLabel(n), changeType: 'removed' })
    }
  }
  for (const n of current.nodes) {
    const prior = savedNodesById.get(n.id)
    if (!prior) continue
    const changedFields = diffFields(NODE_FIELDS, prior, n)
    if (changedFields.length > 0) {
      modified.push({ kind: 'node', id: n.id, label: nodeLabel(n), changeType: 'modified', changedFields })
    }
  }

  const savedEdgesById = new Map(saved.edges.map((e) => [e.id, e]))
  const currentEdgesById = new Map(current.edges.map((e) => [e.id, e]))

  for (const e of current.edges) {
    if (!savedEdgesById.has(e.id)) {
      added.push({ kind: 'edge', id: e.id, label: edgeLabel(e, currentLabelsById), changeType: 'added' })
    }
  }
  for (const e of saved.edges) {
    if (!currentEdgesById.has(e.id)) {
      removed.push({ kind: 'edge', id: e.id, label: edgeLabel(e, savedLabelsById), changeType: 'removed' })
    }
  }
  for (const e of current.edges) {
    const prior = savedEdgesById.get(e.id)
    if (!prior) continue
    const changedFields = diffFields(EDGE_FIELDS, prior, e)
    if (changedFields.length > 0) {
      modified.push({
        kind: 'edge',
        id: e.id,
        label: edgeLabel(e, currentLabelsById),
        changeType: 'modified',
        changedFields
      })
    }
  }

  return { added, removed, modified }
}
