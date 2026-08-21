# 0043: Layer order (z-height) control

## Status
Done, pending PR/merge. Confirmed working in the running app by the user (2026-08-21) on `epic/0043-layer-order-control`, after two same-day drag-interaction fixes prompted by that testing — see [ADR 0035](../../decisions/0035-layer-order-control.md). Raised by the user (2026-08-20) while reviewing the C4 gallery diagrams.

## Goal
A way to control the stacking order of canvas objects (which one renders on top when two overlap) — not just a blind "bring to front" action, but real visibility into what's currently stacked where. The user's own framing: "a view that lets me see each object and their z height."

## Relevant existing behavior
There's currently no explicit layering concept anywhere in this app or `docs/file-format.md`. Paint order is implicit: React Flow renders `nodes`/`edges` in array order (later in the array paints on top), and a handful of ad hoc `z-index` CSS values exist for UI chrome (context menu at 50, icon picker at 30, highlight chips at 5, etc. — `main.css`) but nothing exposed to the user as a concept they can see or control for diagram content itself. Containers additionally have a real ordering *requirement*, not just a convention: `docs/file-format.md` requires a parent node to appear earlier in the `nodes` array than its children (React Flow's own constraint) — any layering feature needs to not break that.

## Decided
See [ADR 0035](../../decisions/0035-layer-order-control.md) for full reasoning. Summary:
- **Persisted, integer `DiagramNode.zIndex`** — not array-order reordering. Backfilled with sparse gaps from current array order on first load of a pre-existing file, preserving today's visual stacking exactly.
- **Scope: Shape/Text/Container nodes only.** Edges always get a derived z-index (`(source.z + target.z) / 2`, computed at render time, never stored) — no independent edge ordering.
- **No hierarchy in v1** — a flat list, not a tree mirroring container nesting. Deferred until/if a grouping-and-locking feature exists.
- **UI: a flat, drag-reorderable list in the existing right-side dock**, sorted z-index descending (top of list = frontmost), each row showing a one-letter type badge (S/C/T), the node's label, and its z-index. Clicking a row points at the node on canvas via a new **entity highlight** — the user's own distinction from epic 0026's existing *property* highlight (which colors every entity sharing a metadata value; this instead points at one specific entity regardless of its properties). Deliberately not real selection (would surface the property panel, which the user explicitly doesn't want showing a z-index that "is not a property of the concept the shape encapsulates").
- **Containers-behind-shapes stops being a hard rule.** It's now just the *backfilled starting values* — drag a container above a shape in the panel and it genuinely renders above that shape from then on. No type-based special-casing survives in the render computation.
- **Reorder algorithm**: average the two new neighbors' z-index when there's integer room (`high - low >= 2`); cascade-shift the contiguous saturated block by 1 when there isn't (the user's own worked example: neighbors at 10/11, midpoint 11.5 collides); extrapolate a real gap at a boundary (only one neighbor).
- ~~**Relationship to epic 0042**~~ — resolved: [0042](0042-edge-label-behind-edge.md) shipped (2026-08-21) as an unrelated CSS z-index bug ([ADR 0030](../../decisions/0030-edge-label-z-index-override.md)), not a symptom of the missing general layering model this epic is about.

## Implementation checklist
- [x] Schema: `DiagramNode.zIndex?: number` in `src/shared/diagram.ts`, wired into `serializeDiagram`/`toDiagramFile`/`fromDiagramFile`.
- [x] Load-time backfill: sparse integer values seeded from array order wherever `zIndex` is absent (`applyZIndexBackfill`, alongside the existing required-tags reconciliation pass).
- [x] New-node creation (`addShapeNode`/`addTextNode`/`addContainerNode`, plus `resolveAnchorNode` — an anchor resolving into a real shape/container needs one too) seeds `zIndex` above the current maximum, container-seeding scoped to other containers only so a brand new container still defaults behind existing shapes.
- [x] `Canvas.tsx`'s `zIndexedNodes`: dropped the type-based tier check, uses `data.zIndex` directly (React Flow's own selection elevation still applies on top); a matching computed edge z (average of endpoints) feeds `zIndexedEdges`/rendering.
- [x] Reorder algorithm (average / cascade-shift / boundary-extrapolate) as a pure, testable function — `src/renderer/src/layers/zIndexOrdering.ts`, no React Flow coupling.
- [x] New `LayerPanel` component in `UtilityDock`, toggle button ("Layers…"), list rows (type badge + label + z-index), native HTML5 drag-to-reorder.
- [x] Session-only entity-highlight indicator (`entityHighlightNodeId` in `DiagramContext`), a dashed outline distinct from both selection and the existing property-highlight border override.
- [x] `docs/file-format.md`: new `zIndex` field entry, Versioning line.
- [x] Typecheck/lint clean.
- [x] Sanity-check in the running app — done by the user, who found two real drag-interaction bugs fixed same-day: (1) dropping directly onto a row left which side it'd land on as a hidden detail, replaced with a visible insertion line between rows; (2) the insertion line and other gaps had no drop handler, producing a "not allowed" cursor and a failed drop — fixed by moving drag-over/drop listening to the whole list and computing the target slot geometrically.

## Notes
Second epic in the "Canvas" batch group (see [PROGRESS.md](../../../PROGRESS.md)), after epic 0040.

~~**2026-08-20: relationship to epic 0046**~~ — resolved: [0046](0046-edge-selection-highlight-and-priority.md) shipped (2026-08-21) with its own narrow fix (`Canvas.tsx`'s `orderedEdges`, DOM paint order, not z-index) for the specific "selected edge wins an overlapping reconnect-handle click" problem — didn't need or wait on this epic's general model.
