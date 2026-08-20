# 0034: Unified tag and metadata system

## Status
Done and merged to `master` ([PR #18](https://github.com/NoobsDeSroobs/context-heavy-diagram-tool/pull/18)), 2026-08-20. The user's own click-through testing surfaced several real bugs — a permanently-open empty utility dock, a per-keystroke sync bug that left one leftover tag per letter typed while renaming a required tag, and a metadata "add" row that couldn't set a value — plus a few UX refinements (metadata grouped into Required/User/External sections, an allowed-values dropdown, a diagnostics "Recheck" button). All fixed before merge. `npm run typecheck`/`lint` clean. Fully scoped via direct design discussion with the user; see [ADR 0022](../../decisions/0022-unified-tag-and-metadata-system.md) for the full decision record and reasoning — this doc is the implementation checklist.

Replaces [epic 0021](0021-detail-frontmatter.md) (retired) and [epic 0023](0023-custom-metadata-bucket.md) (superseded) — both of their motivations are covered by this design instead. [Epic 0026](0026-tagging-and-overlay-visualization.md)'s tag-storage design is revised to point here; that epic's own remaining scope narrows to the highlight/overlay visualization layer built on top.

## Goal
A single metadata mechanism per Shape/Container/Edge — key-value entries that can be freely added by a human, or required by the diagram itself (a curated, always-present, optionally-validated field template), with every entry visible and interpretable both by the app's own features (highlighting, epic 0026) and by external tooling — not an opaque bag the app deliberately ignores.

## Tasks

### Schema (`src/shared/diagram.ts`) — DONE
- [x] `JsonValue` recursive type (carried over from ADR 0009)
- [x] `MetadataLock = 'lockedEditable' | 'lockedStatic'`, `MetadataEntry = { value: JsonValue; lock?: MetadataLock }`
- [x] `metadata?: Record<string, MetadataEntry>` on `DiagramNode` (top-level sibling to `data`, same reasoning as ADR 0009) and `DiagramEdge` (top-level, sibling to `label`)
- [x] `metadata?: Record<string, JsonValue>` on `DiagramFile` itself — simple unlocked dict, no required-tags concept at the diagram level (see ADR 0022's Consequences)
- [x] `RequiredTagDefinition = { key: string; allowedValues?: string[]; defaultValue?: JsonValue; lock: MetadataLock }`, `requiredTags?: RequiredTagDefinition[]` on `DiagramFile`
- [x] `serializeDiagram`: carries all of the above through; `sortKeysDeep`/`sortedMetadata` helpers do recursive alphabetical key-sort for determinism (metadata dict keys **and** any nested object values within an entry)
- [x] `parseDiagram` still has **no metadata-specific validation** — decided to leave it exactly as lenient as every other optional field (no other field is validated either); see the comment above `parseDiagram` in `diagram.ts`. Canvas's own `syncElementMetadata` is what actually reconciles reality against `requiredTags`, on every load.

### Seeding and sync (`src/renderer/src/Canvas.tsx`) — DONE
- [x] New Shape/Container/Edge creation seeds `data.metadata` from `requiredTags` (using `defaultValue`/`lock`) — `seedMetadata`, used in `addShapeNode`/`addContainerNode`/`onConnect`/`onConnectEnd`'s edge-to-anchor case
- [x] `resolveAnchorNode` (epic 0014) also seeds `data.metadata` at the point an anchor becomes a real Shape/Container
- [x] Backfill/sync logic (`syncElementMetadata`), triggered when `requiredTags` itself is edited (`updateRequiredTags`) and defensively on file open (`loadDiagramIntoCanvas`) — collision-affixing implemented on the *reinstating* side (demote-then-reinstate cycle, per ADR 0022): a pre-existing free entry sitting on a key that's newly (re)required gets bumped to `"<key> (demoted)"` rather than clobbered
- [x] Each reset/demotion/collision produces one diagnostics-panel entry, in the ADR's own phrasing ("Invalid value in `<label>.<key>`, reset to default value.")

### Properties Panel UI (`src/renderer/src/panels/PropertyPanel.tsx` or equivalent) — DONE
- [x] New "Metadata" section (`src/renderer/src/panels/MetadataSection.tsx`) for Shape/Container/Edge selections (not Text, not Anchor) — list view, one row per `data.metadata` entry: key, value, lock indicator (greyed out when locked, normal otherwise)
- [x] Add/remove rows for unlocked entries; locked entries' key can't be removed (remove button just isn't rendered for a locked row)
- [x] Editing a value reuses `EditableLabel` directly rather than reimplementing its convention — locked-static entries render as a plain span, never wrapped in `EditableLabel`, so they can't enter edit mode at all
- [x] Nested/non-string values render and edit via their stringified JSON form in that one cell (`stringifyValue`/`parseValue`)
- [x] Diagram-level `requiredTags` template editor (`src/renderer/src/components/RequiredTagsPanel.tsx`) — landed as a `UtilityDock` surface (same shell as `DetailsPanel`), toggled from a new toolbar button, rather than a popup — the dock's own "content about the diagram, not part of editing it directly" framing (ADR 0013) fit a multi-row template editor better than a small anchored popup

### Diagnostics/notifications panel (new) — DONE
- [x] `src/renderer/src/components/DiagnosticsPanel.tsx` — list of non-blocking notices, same `UtilityDock` shell, toggled from its own toolbar button (shows a `(N)` count badge). Session-only: the list is replaced (not appended to) on every sync pass, per the user's own framing when confirming this ("the diagnostics show the current state; any remaining issues will show up again on reopen")
- [x] Generic `string[]` shape — no epic-0034-specific fields — so future diagram-health checks can push their own messages onto the same list without a shape change

### Docs
- [x] `docs/file-format.md`: `data.metadata` (node/edge), `DiagramFile.metadata`, `DiagramFile.requiredTags` — full field tables under new "Metadata"/"Required tags" sections, matching existing conventions
- [x] `examples/with-metadata.chd` — a `requiredTags` template plus a required (`lockedEditable`) and a free tag on a node, listed in `examples/README.md`

## Notes
Node/edge type scope: Shape, Container, Edge get metadata. Text does not (never connectable, not really "a thing" metadata would describe — flagged by the user as possibly revisited later, not a permanent ruling). Anchor does not (transient placeholder per ADR 0015, gains metadata naturally once resolved into a real Shape/Container).

Two implementation-level judgment calls from the mid-epic scoping pass, both confirmed directly with the user before finishing the build:
- **Properties Panel Metadata section is single-selection only.** Confirmed — same reasoning as originally scoped: metadata is a variable-length, per-element key set, unlike every other field's single-scalar "mixed across selection" convention, so a real multi-select UI would need its own design pass this epic didn't need to take on.
- **Diagnostics entries are ephemeral (session-only), not persisted to the file.** Confirmed, with the user's own framing: "the diagnostics show the current state; any remaining issues will show up again on reopen" — i.e. the list is *replaced* on every sync pass, not appended to, matching how `DiagnosticsPanel.tsx` is actually implemented.

**Post-merge fixes from the user's own click-through testing:** a permanently-open empty utility dock (fixed), a per-keystroke sync bug that left one leftover tag per letter typed while renaming a required tag (fixed), and a metadata "add" row that couldn't actually set a value (fixed) — plus UX refinements: metadata grouped into Required/User/External sections, an allowed-values dropdown for `requiredTags` entries that define them, and a diagnostics panel "Recheck" button. All landed before merge to `master`.
