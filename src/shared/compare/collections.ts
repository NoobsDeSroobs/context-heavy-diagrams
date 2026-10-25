// The diagram-level parts of a diagram (catalogs and settings) that the canvas cannot colour, so a
// comparison lists them separately. Coarse on purpose: which collection changed and which entries
// came, went or differ.

import type { DiagramFile } from '../diagram'
import { deepEqual } from '../document/changesSinceSave.ts'

export interface CollectionChange {
  name: string
  added: string[]
  removed: string[]
  changed: string[]
  // A single value that differs, for the settings that are not a list.
  setting?: { before: string; after: string }
}

function diffEntries<T>(
  name: string,
  base: T[] | undefined,
  next: T[] | undefined,
  keyOf: (entry: T) => string,
  labelOf: (entry: T) => string
): CollectionChange | null {
  const was = new Map((base ?? []).map((e) => [keyOf(e), e]))
  const now = new Map((next ?? []).map((e) => [keyOf(e), e]))
  const result: CollectionChange = { name, added: [], removed: [], changed: [] }
  for (const [key, entry] of now) {
    const prior = was.get(key)
    if (!prior) result.added.push(labelOf(entry))
    else if (!deepEqual(prior, entry)) result.changed.push(labelOf(entry))
  }
  for (const [key, entry] of was) if (!now.has(key)) result.removed.push(labelOf(entry))
  return result.added.length + result.removed.length + result.changed.length > 0 ? result : null
}

function setting(name: string, before: unknown, after: unknown): CollectionChange | null {
  if (deepEqual(before, after)) return null
  const text = (v: unknown): string => (v === undefined ? '(not set)' : String(v))
  return {
    name,
    added: [],
    removed: [],
    changed: [],
    setting: { before: text(before), after: text(after) }
  }
}

export function diffCollections(base: DiagramFile, next: DiagramFile): CollectionChange[] {
  const labelOfNode = (file: DiagramFile) => (id: string) =>
    file.nodes.find((n) => n.id === id)?.data.label.split('\n')[0] || id
  const matrixIds = (file: DiagramFile): string[] => file.security?.matrixEntityIds ?? []
  const baseLabel = labelOfNode(base)
  const nextLabel = labelOfNode(next)

  // The metadata bag is key to value, not a list of entries.
  const bagKeys = (file: DiagramFile): { key: string; value: unknown }[] =>
    Object.entries(file.metadata ?? {}).map(([key, value]) => ({ key, value }))

  const matrixEntities = diffEntries(
    'Security matrix entities',
    matrixIds(base).map((id) => ({ id, label: baseLabel(id) })),
    matrixIds(next).map((id) => ({ id, label: nextLabel(id) })),
    (e) => e.id,
    (e) => e.label
  )

  const changes: (CollectionChange | null)[] = [
    diffEntries(
      'Required tags',
      base.requiredTags,
      next.requiredTags,
      (t) => t.key,
      (t) => t.key
    ),
    diffEntries(
      'Highlights',
      base.highlights,
      next.highlights,
      (h) => `${h.key}=${JSON.stringify(h.value)}`,
      (h) => `${h.key}=${typeof h.value === 'string' ? h.value : JSON.stringify(h.value)}`
    ),
    diffEntries(
      'Legend',
      base.legend,
      next.legend,
      (l) => l.id,
      (l) => l.label
    ),
    diffEntries(
      'Line bend presets',
      base.gravityPresets,
      next.gravityPresets,
      (g) => g.id,
      (g) => g.label
    ),
    diffEntries(
      'Edge direction sets',
      base.edgeDirectionSets,
      next.edgeDirectionSets,
      (s) => s.id,
      (s) => s.name
    ),
    diffEntries(
      'Security threats',
      base.security?.threats,
      next.security?.threats,
      (t) => t.id,
      (t) => t.name
    ),
    matrixEntities,
    diffEntries(
      'Diagram tags',
      bagKeys(base),
      bagKeys(next),
      (e) => e.key,
      (e) => e.key
    ),
    setting('Active direction set', base.activeEdgeDirectionSetId, next.activeEdgeDirectionSetId),
    setting(
      'Max connection points per side',
      base.maxConnectionPointsPerSide,
      next.maxConnectionPointsPerSide
    ),
    setting('Diagram font', base.fontFamily, next.fontFamily),
    setting(
      'Security hidden threats',
      base.security?.hiddenThreatIds,
      next.security?.hiddenThreatIds
    ),
    setting(
      'Security hidden entities',
      base.security?.hiddenEntityIds,
      next.security?.hiddenEntityIds
    ),
    setting(
      'Security probability scale',
      base.security?.probabilityScale,
      next.security?.probabilityScale
    ),
    setting(
      'Security consequence scale',
      base.security?.consequenceScale,
      next.security?.consequenceScale
    )
  ]
  return changes.filter((c): c is CollectionChange => c !== null)
}
