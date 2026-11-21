// The rule of visibility sets (ADR 0194), the one place that decides whether an element is visible.
// Which sets are hidden is session state held by the editor; the catalogue and the elements'
// `visibilitySetIds` come from the file.
import type { VisibilitySet } from './schema.ts'

// An element in no set is always visible. Otherwise it is visible when any of its sets is shown (the
// union). An id that is not in the catalogue is ignored, so a deleted set cannot hide anything.
export function isVisible(
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
export function visibleFilter(
  catalogue: readonly VisibilitySet[],
  hiddenIds: ReadonlySet<string>
): (setIds: readonly string[] | undefined) => boolean {
  const catalogueIds = new Set(catalogue.map((s) => s.id))
  const hiddenKnown = new Set([...hiddenIds].filter((id) => catalogueIds.has(id)))
  if (hiddenKnown.size === 0) return () => true
  return (setIds) => isVisible(setIds, catalogueIds, hiddenKnown)
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

// A new id, unique in the catalogue and among the ids elements still list. Opaque: nothing reads it
// and a person never sees it; the name is what is shown, so renaming a set changes no id.
export function newSetId(
  catalogue: readonly VisibilitySet[],
  referenced: Iterable<string> = []
): string {
  const taken = new Set([...catalogue.map((s) => s.id), ...referenced])
  let id: string
  do {
    id = `vis-${Math.random().toString(36).slice(2, 8)}`
  } while (taken.has(id))
  return id
}

// Whether a name is already used by another set, ignoring case and the space around it. A set's
// name is unique in the diagram (ADR 0194); `exceptId` is the set being renamed.
export function nameTaken(
  catalogue: readonly VisibilitySet[],
  name: string,
  exceptId?: string
): boolean {
  const wanted = name.trim().toLowerCase()
  return catalogue.some((s) => s.id !== exceptId && s.name.trim().toLowerCase() === wanted)
}

// The ids that elements list but the catalogue does not hold, each once. They are ignored by the
// rule; Diagnostics lists them.
export function strayIds(
  catalogue: readonly VisibilitySet[],
  lists: Iterable<readonly string[] | undefined>
): string[] {
  const known = new Set(catalogue.map((s) => s.id))
  const stray = new Set<string>()
  for (const ids of lists) {
    for (const id of ids ?? []) if (!known.has(id)) stray.add(id)
  }
  return [...stray]
}

// The line Diagnostics shows for stray ids, or none (ADR 0194): nothing is removed or changed.
export function strayAdvisory(
  catalogue: readonly VisibilitySet[],
  lists: Iterable<readonly string[] | undefined>
): string[] {
  const stray = strayIds(catalogue, lists)
  if (stray.length === 0) return []
  return [
    `Visibility sets: ${stray.length} id(s) in elements belong to no set of this diagram (${stray.join(', ')}). They are ignored, so those elements are never hidden by them, and they are kept in the file.`
  ]
}
