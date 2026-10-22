import type { Node } from '@xyflow/react'
import type { IconRef, IconSlot, LegendEntry } from '@shared/diagram'
import type { MissingFileEntry } from './DiagnosticsPanel'

// Every on-disk resource path referenced by a diagram element — for the
// Diagnostics "missing files" check (ADR 0084). `resolvedPath` is filled in
// later, after main reports back which paths don't exist.
export function collectResourceRefs(
  nodeList: Node[],
  legendList: LegendEntry[]
): Omit<MissingFileEntry, 'resolvedPath'>[] {
  const refs: Omit<MissingFileEntry, 'resolvedPath'>[] = []
  for (const n of nodeList) {
    const ownerLabel = String(n.data?.label ?? '')
    const ownerType = n.type ?? 'entity'
    const base = { ownerKind: 'node' as const, ownerId: n.id, ownerLabel, ownerType }
    const d = n.data ?? {}
    if (typeof d.linkedDiagram === 'string' && d.linkedDiagram) {
      refs.push({
        ...base,
        key: `${n.id}:linkedDiagram`,
        resourceKind: 'linkedDiagram',
        relativePath: d.linkedDiagram
      })
    }
    if (typeof d.details === 'string' && d.details) {
      refs.push({
        ...base,
        key: `${n.id}:details`,
        resourceKind: 'details',
        relativePath: d.details
      })
    }
    const icons = d.icons as Partial<Record<IconSlot, IconRef>> | undefined
    for (const [slot, ref] of Object.entries(icons ?? {})) {
      if (ref?.source === 'custom' && typeof ref.path === 'string') {
        refs.push({
          ...base,
          key: `${n.id}:icon:${slot}`,
          resourceKind: 'icon',
          relativePath: ref.path,
          iconSlot: slot
        })
      }
    }
    const references = Array.isArray(d.references) ? (d.references as string[]) : []
    references.forEach((p, i) => {
      if (typeof p === 'string' && p) {
        refs.push({
          ...base,
          key: `${n.id}:reference:${i}`,
          resourceKind: 'reference',
          relativePath: p
        })
      }
    })
  }
  for (const e of legendList) {
    if (e.kind === 'icon' && e.icon?.source === 'custom' && typeof e.icon.path === 'string') {
      refs.push({
        key: `legend:${e.id}`,
        ownerKind: 'legend',
        ownerId: e.id,
        ownerLabel: e.label,
        ownerType: 'legend',
        resourceKind: 'icon',
        relativePath: e.icon.path
      })
    }
  }
  return refs
}

// Apply one staged missing-file removal (ADR 0084) to a nodes+legend pair —
// the same mutation each element's own UI does. Pure; used at save time
// (persistDiagram), so a staged removal only ever reaches disk on save.
export function applyMissingFileRemoval(
  nodes: Node[],
  legend: LegendEntry[],
  entry: MissingFileEntry
): { nodes: Node[]; legend: LegendEntry[] } {
  if (entry.ownerKind === 'legend') {
    return { nodes, legend: legend.filter((e) => e.id !== entry.ownerId) }
  }
  return {
    legend,
    nodes: nodes.map((n) => {
      if (n.id !== entry.ownerId) return n
      const d: Record<string, unknown> = { ...n.data }
      switch (entry.resourceKind) {
        case 'linkedDiagram':
          d.linkedDiagram = undefined
          break
        case 'details':
          d.details = undefined
          break
        case 'icon': {
          const icons = { ...(d.icons as Partial<Record<IconSlot, IconRef>> | undefined) }
          if (entry.iconSlot) delete icons[entry.iconSlot as IconSlot]
          d.icons = Object.keys(icons).length > 0 ? icons : undefined
          break
        }
        case 'reference': {
          const refs = (Array.isArray(d.references) ? (d.references as string[]) : []).filter(
            (p) => p !== entry.relativePath
          )
          d.references = refs.length > 0 ? refs : undefined
          break
        }
      }
      return { ...n, data: d }
    })
  }
}
