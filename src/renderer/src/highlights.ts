import type { HighlightDefinition, JsonValue, MetadataEntry } from '@shared/diagram'

// A single-match highlight overrides a node's border or an edge's stroke,
// drawn a bit thicker than the default 1.5px — see ADR 0025.
export const HIGHLIGHT_BORDER_WIDTH = 3

// Every newly-created highlight starts here — both "Add highlight" and
// "Add group" (ADR 0026) — rather than a rotating palette,
// specifically so a fresh entry can never accidentally collide with a
// color that already means something elsewhere. Deliberately neutral;
// the user recolors deliberately.
export const DEFAULT_HIGHLIGHT_COLOR = '#ffffff'

// Stable identity for a highlight — used both for the enabled-set (Canvas
// state) and to enforce catalog uniqueness when adding a new one. Two
// highlights for the same key+value would be ambiguous (which color
// applies?), so a highlight is uniquely identified by its key+value, not
// by array position (which shifts on remove/reorder).
export function highlightId(h: { key: string; value: HighlightDefinition['value'] }): string {
  return `${h.key}::${JSON.stringify(h.value)}`
}

// "Add group" (ADR 0026): reconciles the catalog's entries for
// one key against the values that key currently, actually carries
// somewhere in the diagram — adds a white entry for a value not yet
// covered, and *removes* an existing entry whose value nothing carries
// anymore (a stale row for a retired value is actively misleading, not
// harmless leftover state — confirmed directly with the user). Existing
// entries for values still in use are returned untouched, keeping
// whatever color/position they already had. Entries for every other key
// are left alone. Pure — the caller (Canvas.tsx) supplies currentValues
// from its own scan of live node/edge metadata and applies the result.
export function reconcileHighlightGroup(
  highlights: HighlightDefinition[],
  key: string,
  currentValues: JsonValue[]
): HighlightDefinition[] {
  const currentIds = new Set(currentValues.map((value) => highlightId({ key, value })))
  const kept = highlights.filter((h) => h.key !== key || currentIds.has(highlightId(h)))
  const keptIds = new Set(kept.map(highlightId))
  const added: HighlightDefinition[] = currentValues
    .filter((value) => !keptIds.has(highlightId({ key, value })))
    .map((value) => ({ key, value, color: DEFAULT_HIGHLIGHT_COLOR }))
  return [...kept, ...added]
}

// Every enabled highlight whose key=value exactly matches this element's
// metadata. Recomputed per render, not cached — diagrams are small enough
// that this isn't worth memoizing, same reasoning already used elsewhere
// in Canvas.tsx (e.g. selectedNodes/selectedEdges).
export function matchingHighlights(
  metadata: Record<string, MetadataEntry> | undefined,
  highlights: HighlightDefinition[],
  enabledIds: Set<string>
): HighlightDefinition[] {
  if (!metadata) return []
  return highlights.filter((h) => {
    if (!enabledIds.has(highlightId(h))) return false
    const entry = metadata[h.key]
    return entry !== undefined && JSON.stringify(entry.value) === JSON.stringify(h.value)
  })
}
