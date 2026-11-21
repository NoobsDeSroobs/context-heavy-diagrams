// The rule of visibility sets (ADR 0194), the one place that decides whether an element is shown.
// Which sets are hidden is session state held by the editor; the catalogue and the elements'
// `visibilitySetIds` come from the file.
import type { VisibilitySet } from './schema.ts'

// An element in no set is always shown. Otherwise it is shown when any of its sets is shown (the
// union). An id that is not in the catalogue is ignored, so a deleted set cannot hide anything.
export function isShown(
  setIds: readonly string[] | undefined,
  catalogueIds: ReadonlySet<string>,
  hiddenIds: ReadonlySet<string>
): boolean {
  if (!setIds || setIds.length === 0) return true
  let inAKnownSet = false
  for (const id of setIds) {
    if (!catalogueIds.has(id)) continue
    inAKnownSet = true
    if (!hiddenIds.has(id)) return true
  }
  return !inAKnownSet
}

// The rule bound to one catalogue and one choice of hidden sets, for mapping over many elements.
// Nothing hidden (or only ids no longer in the catalogue) shows everything without looking.
export function shownFilter(
  catalogue: readonly VisibilitySet[],
  hiddenIds: ReadonlySet<string>
): (setIds: readonly string[] | undefined) => boolean {
  const catalogueIds = new Set(catalogue.map((s) => s.id))
  const hiddenKnown = new Set([...hiddenIds].filter((id) => catalogueIds.has(id)))
  if (hiddenKnown.size === 0) return () => true
  return (setIds) => isShown(setIds, catalogueIds, hiddenKnown)
}

// The ids of an element after it joins a set; the same list when it is already in it.
export function withSet(setIds: readonly string[] | undefined, setId: string): string[] {
  const ids = setIds ?? []
  return ids.includes(setId) ? [...ids] : [...ids, setId]
}

// The ids of an element after it leaves a set; undefined when it is then in none.
export function withoutSet(
  setIds: readonly string[] | undefined,
  setId: string
): string[] | undefined {
  const rest = (setIds ?? []).filter((id) => id !== setId)
  return rest.length > 0 ? rest : undefined
}

// A new id, unique in the catalogue. Opaque: nothing reads it, and it never changes when the
// set is renamed.
export function newSetId(catalogue: readonly VisibilitySet[]): string {
  const taken = new Set(catalogue.map((s) => s.id))
  let id: string
  do {
    id = `vis-${Math.random().toString(36).slice(2, 8)}`
  } while (taken.has(id))
  return id
}
