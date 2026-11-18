import type { Node } from '@xyflow/react'
import type { IconRef, IconSlot, LegendEntry } from '@shared/diagram'
import type { PackSummary } from '@shared/icons/installedPacks'
import type { IconPackNote } from '@shared/icons/schema'

// An element that draws an installed icon (ADR 0188).
export interface InstalledIconUse {
  pack: string
  path: string
  // Where the icon is: a node (its slot) or a legend entry.
  ownerKind: 'node' | 'legend'
  ownerId: string
  ownerLabel: string
  ownerType: string
}

// A pack the diagram's icons name that is not installed on this machine.
export interface MissingPack {
  name: string
  // What the file remembers of the pack (its own "if missing" text and version), if anything.
  note: IconPackNote | undefined
  uses: InstalledIconUse[]
}

// An installed pack that lacks an icon the diagram names.
export type MissingIcon = InstalledIconUse

export interface IconPackProblems {
  missingPacks: MissingPack[]
  missingIcons: MissingIcon[]
}

export const NO_ICON_PACK_PROBLEMS: IconPackProblems = { missingPacks: [], missingIcons: [] }

export function collectInstalledIcons(nodes: Node[], legend: LegendEntry[]): InstalledIconUse[] {
  const uses: InstalledIconUse[] = []
  for (const n of nodes) {
    const icons = n.data?.icons as Partial<Record<IconSlot, IconRef>> | undefined
    for (const ref of Object.values(icons ?? {})) {
      if (ref?.source !== 'installed') continue
      uses.push({
        pack: ref.pack,
        path: ref.path,
        ownerKind: 'node',
        ownerId: n.id,
        ownerLabel: String(n.data?.label ?? ''),
        ownerType: n.type ?? 'entity'
      })
    }
  }
  for (const entry of legend) {
    if (entry.kind !== 'icon' || entry.icon?.source !== 'installed') continue
    uses.push({
      pack: entry.icon.pack,
      path: entry.icon.path,
      ownerKind: 'legend',
      ownerId: entry.id,
      ownerLabel: entry.label,
      ownerType: 'legend'
    })
  }
  return uses
}

// What is wrong with the installed icons a diagram uses, against the packs on this machine. A
// second folder that gives a pack's name is not a pack a diagram can use.
export function findIconPackProblems(
  uses: InstalledIconUse[],
  packs: PackSummary[],
  notes: IconPackNote[]
): IconPackProblems {
  const here = new Map(packs.filter((p) => p.duplicateOf === null).map((p) => [p.meta.name, p]))
  const missing = new Map<string, MissingPack>()
  const missingIcons: MissingIcon[] = []
  for (const use of uses) {
    const pack = here.get(use.pack)
    if (!pack) {
      const entry = missing.get(use.pack) ?? {
        name: use.pack,
        note: notes.find((note) => note.name === use.pack),
        uses: []
      }
      entry.uses.push(use)
      missing.set(use.pack, entry)
      continue
    }
    const slash = use.path.indexOf('/')
    const subset = pack.subsets.find((s) => s.folder === use.path.slice(0, slash))
    if (slash < 0 || !subset?.icons.includes(use.path.slice(slash + 1))) missingIcons.push(use)
  }
  return {
    missingPacks: [...missing.values()].sort((a, b) => a.name.localeCompare(b.name)),
    missingIcons
  }
}
