import type { HighlightDefinition, MetadataEntry } from '@shared/diagram'

// A single-match highlight overrides a node's border or an edge's stroke,
// drawn a bit thicker than the default 1.5px — see epic 0026/ADR 0025.
export const HIGHLIGHT_BORDER_WIDTH = 3

// Stable identity for a highlight — used both for the enabled-set (Canvas
// state) and to enforce catalog uniqueness when adding a new one. Two
// highlights for the same key+value would be ambiguous (which color
// applies?), so a highlight is uniquely identified by its key+value, not
// by array position (which shifts on remove/reorder).
export function highlightId(h: { key: string; value: HighlightDefinition['value'] }): string {
  return `${h.key}::${JSON.stringify(h.value)}`
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
