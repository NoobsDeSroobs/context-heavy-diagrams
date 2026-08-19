# 0023: Custom metadata bucket

## Status
Superseded 2026-08-20 by [epic 0034](0034-unified-tag-and-metadata-system.md) — see [ADR 0022](../../decisions/0022-unified-tag-and-metadata-system.md), which supersedes this epic's own [ADR 0009](../../decisions/0009-custom-metadata-bucket.md) in turn. The separate-bucket-vs-tags split and raw-JSON-textarea GUI below were both revised once tagging (epic 0026) was designed properly alongside this. Kept here for historical context; epic 0034 is where this actually gets implemented.

## Goal
A free-form, arbitrary-JSON metadata dict on nodes, edges, and the diagram itself — separate from the fields the tool already understands and manages (`data.label`/`icons`/`details`/`linkedDiagram`) — viewable and editable both through the raw `.chd` file and from the GUI, and guaranteed to survive being opened and saved by the app. See [ADR 0009](../../decisions/0009-custom-metadata-bucket.md) for the full design and reasoning; this epic is the implementation checklist.

Motivation: scripts/AI-assisted generation attaching bookkeeping data (external IDs, provenance, source-system references) to elements, expected to survive round-tripping through the GUI — currently it doesn't, since `serializeDiagram`/`fromDiagramFile`/`toDiagramFile` all reconstruct objects from a fixed field whitelist.

## Tasks

### Schema (`src/shared/diagram.ts`)
- [ ] Add `JsonValue` recursive type
- [ ] Add `metadata?: Record<string, JsonValue>` to `DiagramNode` (top-level sibling to `data`, not nested inside it — see ADR 0009 for why)
- [ ] Add `metadata?: Record<string, JsonValue>` to `DiagramEdge` (top-level, sibling to `label`)
- [ ] Add `metadata?: Record<string, JsonValue>` to `DiagramFile` (top-level, sibling to `nodes`/`edges`)
- [ ] `parseDiagram`: reject a non-object `metadata` value at any of the three levels with a clear error; validate no deeper than "is it a plain object"
- [ ] `serializeDiagram`: carry `metadata` through at all three levels; add a recursive key-sort helper so metadata serializes with alphabetically sorted keys at every nesting level (determinism, matching the rest of the format)

### Canvas state (`src/renderer/src/Canvas.tsx`)
- [ ] `fromDiagramFile`: node file-level `metadata` → `node.data.metadata` (React Flow has no top-level extension point beyond `data`); edge file-level `metadata` → `edge.data.metadata`; diagram-level `metadata` → new `CanvasInner` state
- [ ] `toDiagramFile`: reverse of the above
- [ ] New `diagramMetadata` state (analogous to how `currentPath` etc. work), flushed into `toDiagramFile`'s output on save
- [ ] New toolbar button "Diagram metadata…" opening a small popup (new component, or extend an existing popup pattern) editing the diagram-level JSON textarea

### Node metadata (`src/renderer/src/components/DetailsPanel.tsx`)
- [ ] Add a "Notes" / "Metadata" tab (or equivalent) alongside the existing edit/preview toggle — Notes keeps today's Markdown behavior unchanged, Metadata is a new JSON textarea
- [ ] Draft-state pattern mirroring the existing `detailsDrafts` (`metadataDrafts` in `Canvas.tsx`), flushed on save the same way
- [ ] Inline JSON validation — invalid JSON shown as an error in the panel, blocks the whole diagram save (Ctrl+S / Save button) with a clear alert, never silently drops or corrupts

### Edge metadata (`src/renderer/src/edges/LabeledEdge.tsx`)
- [ ] First-ever context menu on edges — reuse the existing generic `ContextMenu` component (same as nodes), single item "Edit metadata…"
- [ ] Small popup (same fixed-positioned-popup pattern as `IconPicker`) with a JSON textarea, wired into `Canvas.tsx`'s edge state the same way node metadata drafts work

### Docs
- [ ] `docs/file-format.md`: real `data.metadata`/edge `metadata`/diagram `metadata` entries, matching the existing per-field table format; note the alphabetical-key-sorting behavior
- [ ] At least one example in epic 0022's gallery (or a standalone example) should actually demonstrate metadata on a node, an edge, and the diagram itself — good proof this round-trips correctly outside of just the automated checks

## Notes
- This directly resolves the round-trip gap found while discussing epic 0022 — anything **outside** the documented schema (including outside this new `metadata` field) still gets silently dropped on open, same as always. That's intentional: the sanctioned extensibility point is `metadata`, not blanket permissiveness across the whole format.
- Raw-JSON-textarea editing was chosen over a structured key-value table specifically because it's cheap and matches the existing Markdown editor's "no rich WYSIWYG" philosophy — but it's a pure GUI-layer choice sitting on top of the same `metadata` field, so a nicer structured editor can replace it later without any schema change if raw JSON turns out to be too much friction in practice.
- Metadata keys get sorted alphabetically on every save — if a real workflow needs authoring-order preserved instead, that's a legitimate reason to revisit just that one detail (see ADR 0009's Consequences), not the whole design.
