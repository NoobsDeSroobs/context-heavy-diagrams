import type { PackSummary, SubsetSummary } from '@shared/icons/installedPacks'

// How many icons of one subset are drawn before "Show all": a pack can hold thousands, and the
// picker draws a window onto the list, not every element (ADR 0188).
export const SUBSET_ROW_CAP = 60

export const iconTitle = (file: string): string => file.replace(/\.svg$/i, '')

// The icon files of a subset that the search shows. With no query, all of them. A query shows the
// icons whose name has it; one that names the subset or its pack shows the whole subset, since the
// person asked for that group.
export function matchingIcons(pack: PackSummary, subset: SubsetSummary, query: string): string[] {
  const q = query.trim().toLowerCase()
  if (q === '') return subset.icons
  if (pack.meta.name.toLowerCase().includes(q) || subset.meta.name.toLowerCase().includes(q)) {
    return subset.icons
  }
  return subset.icons.filter((file) => iconTitle(file).toLowerCase().includes(q))
}

// The packs a diagram's references can use: a second folder with a pack's name is not one.
export const usablePacks = (packs: PackSummary[]): PackSummary[] =>
  packs.filter((pack) => pack.duplicateOf === null)
