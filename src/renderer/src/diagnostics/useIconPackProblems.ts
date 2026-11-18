import { useEffect, useMemo, useState } from 'react'
import type { Node } from '@xyflow/react'
import type { LegendEntry } from '@shared/diagram'
import type { PackSummary } from '@shared/icons/installedPacks'
import type { IconPackNote } from '@shared/icons/schema'
import {
  collectInstalledIcons,
  findIconPackProblems,
  NO_ICON_PACK_PROBLEMS,
  type IconPackProblems
} from './iconPackProblems'

// The installed icons the diagram uses that this machine cannot draw (ADR 0188): a pack that is not
// installed, or an icon missing from one that is. Derived, not stored: it follows the diagram and
// the installed packs, so installing the pack in the manager clears it at once. The packs are only
// asked for while the diagram uses an installed icon.
export function useIconPackProblems(
  nodes: Node[],
  legend: LegendEntry[],
  notes: IconPackNote[]
): IconPackProblems {
  const uses = useMemo(() => collectInstalledIcons(nodes, legend), [nodes, legend])
  const needed = uses.length > 0
  const [packs, setPacks] = useState<PackSummary[] | null>(null)

  useEffect(() => {
    if (!needed) return undefined
    let cancelled = false
    const load = (): void => {
      void window.api.listIconPacks().then((list) => {
        if (!cancelled) setPacks(list.packs)
      })
    }
    load()
    const stop = window.api.onIconPacksChanged(load)
    return () => {
      cancelled = true
      stop()
    }
  }, [needed])

  return useMemo(
    () => (packs && needed ? findIconPackProblems(uses, packs, notes) : NO_ICON_PACK_PROBLEMS),
    [packs, needed, uses, notes]
  )
}
