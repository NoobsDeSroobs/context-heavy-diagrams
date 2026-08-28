import type { CSSProperties } from 'react'
import type { IconRef, IconSlot, MetadataEntry } from '@shared/diagram'

// Pure free-text matcher behind ADR 0062's V1 search — one
// combined query checked against id, label, and every tag key/value,
// deliberately not split into per-field syntax yet (that's the deferred
// `metadata:*python*`-style scoping the ADR logs for later). Case-
// insensitive substring match, same "matches in some way" framing the
// user gave when this was first raised.
export interface SearchableElement {
  id: string
  label?: string
  metadata?: Record<string, MetadataEntry>
}

function stringifyMetadataValue(entry: MetadataEntry): string {
  return typeof entry.value === 'string' ? entry.value : JSON.stringify(entry.value)
}

export function matchesSearchQuery(query: string, element: SearchableElement): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return false
  if (element.id.toLowerCase().includes(q)) return true
  if (element.label && element.label.toLowerCase().includes(q)) return true
  if (element.metadata) {
    for (const [key, entry] of Object.entries(element.metadata)) {
      if (key.toLowerCase().includes(q)) return true
      if (stringifyMetadataValue(entry).toLowerCase().includes(q)) return true
    }
  }
  return false
}

// Icon-identity search (see ADR 0072) — pick an icon already placed
// somewhere in the diagram, find every other node carrying that same
// icon. A built-in icon is fully identified by its id, a custom one by its
// relative asset path (both plain strings on IconRef), so "same icon" is
// exact equality on the (source, id|path) pair — no fuzzy name matching.
// This is deliberately its own one-dimension search, not combined with the
// free-text query above; ADR 0062 defers all criteria-combining to a
// future real query language.
export function iconRefKey(icon: IconRef): string {
  return icon.source === 'builtin' ? `builtin:${icon.id}` : `custom:${icon.path}`
}

export function nodeHasIcon(
  picked: IconRef,
  icons: Partial<Record<IconSlot, IconRef>> | undefined
): boolean {
  if (!icons) return false
  const key = iconRefKey(picked)
  return Object.values(icons).some((ref) => ref !== undefined && iconRefKey(ref) === key)
}

// "Isolate" (see ADR 0063) — every node/edge component computes its
// own dimmed-or-not state the same way, so this is the one shared spot for
// it rather than four copies of the same three lines. `{}` (no opacity, no
// transition) whenever Isolate is off at all, so turning it off snaps
// back to normal instead of fading — deliberately not chased further, see
// the ADR. A matched element always gets opacity 1 explicitly rather than
// an absent style, so it still picks up the transition when *other*
// elements around it start/stop being dimmed.
export function isolateStyle(
  id: string,
  isolateActive: boolean,
  searchMatchIds: Set<string>,
  isolateOpacity: number
): CSSProperties {
  if (!isolateActive) return {}
  return {
    opacity: searchMatchIds.has(id) ? 1 : isolateOpacity,
    transition: 'opacity 150ms ease'
  }
}
