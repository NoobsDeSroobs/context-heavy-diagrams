// Tag/metadata schema — see ADR 0022 (supersedes ADR 0009). One
// `metadata` bag per node/edge, entries either free (human-added, `lock`
// absent) or diagram-required (see `RequiredTagDefinition` below).
// `lockedEditable`: diagram-required, key can't be removed, value can
// still be filled in/edited by a human. `lockedStatic`: diagram-required,
// fixed, not editable at all. Never used for a free entry — that's what
// `lock` being absent already means.
export type JsonValue =
  string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue }
export type MetadataLock = 'lockedEditable' | 'lockedStatic'
export interface MetadataEntry {
  value: JsonValue
  lock?: MetadataLock
}

// Diagram-level template: what every applicable element (entity/container/
// edge, not text — see ADR 0022) must carry. Not stored per
// element; used to seed new elements and to retroactively backfill
// existing ones when the template itself changes (see Canvas.tsx's
// `syncRequiredTags`).
export interface RequiredTagDefinition {
  key: string
  allowedValues?: string[]
  defaultValue?: JsonValue
  lock: MetadataLock
}

// Highlight catalog — see ADR 0025/ADR 0026. Each entry pairs an exact
// metadata key=value match with a display color. Deliberately no
// `enabled` field here: whether a given highlight is currently toggled on
// is session-only state, never persisted (ADR 0025's "split persistence"
// decision) — a reopened/shared file always starts with every highlight
// off, even though the catalog itself is shared.
export interface HighlightDefinition {
  key: string
  value: JsonValue
  color: string
}
