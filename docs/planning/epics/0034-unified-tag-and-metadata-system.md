# 0034: Unified tag and metadata system

## Status
Not Started — fully scoped via direct design discussion with the user (2026-08-20). See [ADR 0022](../../decisions/0022-unified-tag-and-metadata-system.md) for the full decision record and reasoning; this doc is the implementation checklist.

Replaces [epic 0021](0021-detail-frontmatter.md) (retired) and [epic 0023](0023-custom-metadata-bucket.md) (superseded) — both of their motivations are covered by this design instead. [Epic 0026](0026-tagging-and-overlay-visualization.md)'s tag-storage design is revised to point here; that epic's own remaining scope narrows to the highlight/overlay visualization layer built on top.

## Goal
A single metadata mechanism per Shape/Container/Edge — key-value entries that can be freely added by a human, or required by the diagram itself (a curated, always-present, optionally-validated field template), with every entry visible and interpretable both by the app's own features (highlighting, epic 0026) and by external tooling — not an opaque bag the app deliberately ignores.

## Tasks

### Schema (`src/shared/diagram.ts`)
- [ ] `JsonValue` recursive type (carried over from ADR 0009)
- [ ] `MetadataLock = 'lockedEditable' | 'lockedStatic'`, `MetadataEntry = { value: JsonValue; lock?: MetadataLock }`
- [ ] `metadata?: Record<string, MetadataEntry>` on `DiagramNode` (top-level sibling to `data`, same reasoning as ADR 0009) and `DiagramEdge` (top-level, sibling to `label`)
- [ ] `metadata?: Record<string, JsonValue>` on `DiagramFile` itself — simple unlocked dict, no required-tags concept at the diagram level (see ADR 0022's Consequences)
- [ ] `requiredTags?: { key: string; allowedValues?: string[]; defaultValue?: JsonValue; lock: 'lockedEditable' | 'lockedStatic' }[]` on `DiagramFile`
- [ ] `parseDiagram`/`serializeDiagram`: carry all of the above through; recursive alphabetical key-sort for determinism, matching the rest of the format

### Seeding and sync (`src/renderer/src/Canvas.tsx`)
- [ ] New Shape/Container/Edge creation seeds `data.metadata` from `requiredTags` (using `defaultValue`/`lock`)
- [ ] `resolveAnchorNode` (epic 0014) also seeds `data.metadata` at the point an anchor becomes a real Shape/Container
- [ ] Backfill/sync logic, triggered when `requiredTags` itself is edited (and defensively on file open, in case of hand-edited drift): `lockedEditable` keeps a still-valid value or resets an invalid one; `lockedStatic` always takes the template's current value; a key removed from `requiredTags` demotes existing entries to unlocked rather than deleting them, with collision-affixing if the plain key is already occupied by something else at that point
- [ ] Each reset/demotion produces one diagnostics-panel entry (see below)

### Properties Panel UI (`src/renderer/src/panels/PropertyPanel.tsx` or equivalent)
- [ ] New "Metadata" section for Shape/Container/Edge selections (not Text, not Anchor) — list view, one row per `data.metadata` entry: key, value, lock indicator (greyed out when locked, normal otherwise)
- [ ] Add/remove rows for unlocked entries; locked entries' key can't be removed (UI-disabled, not just discouraged)
- [ ] Editing a value reuses `EditableLabel`'s click-to-edit convention (static display → click swaps to input → commit/cancel) rather than being live-editable in place — applies uniformly, locked-static entries just never enter edit mode
- [ ] Nested/non-string values render and edit via their stringified JSON form in that one cell
- [ ] Diagram-level `requiredTags` template editor — new UI, likely a diagram-level settings surface (exact placement TBD, e.g. extending the "Diagram metadata…" toolbar concept from epic 0023's original plan)

### Diagnostics/notifications panel (new)
- [ ] Minimal first version: a list of non-blocking notices (backfill resets/demotions to start), openable from somewhere in the toolbar (dropdown vs. dock panel — TBD at implementation time, not an architectural decision)
- [ ] Designed to be generically extensible — invalid-metadata-JSON errors and future diagram-health checks are natural later additions, not this epic's problem to solve completely

### Docs
- [ ] `docs/file-format.md`: `data.metadata` (node/edge), `DiagramFile.metadata`, `DiagramFile.requiredTags` — full field tables, matching existing conventions
- [ ] At least one example demonstrating a required tag and a free tag on a node, matching epic 0023's original "prove it round-trips" intent

## Notes
Deliberately left for implementation time, not architectural: exact `MetadataLock` string values/casing, exact demotion-collision affix format, exact diagnostics-panel entry point, whether sync runs only on template edit or also defensively on load.

Node/edge type scope: Shape, Container, Edge get metadata. Text does not (never connectable, not really "a thing" metadata would describe — flagged by the user as possibly revisited later, not a permanent ruling). Anchor does not (transient placeholder per ADR 0015, gains metadata naturally once resolved into a real Shape/Container).
