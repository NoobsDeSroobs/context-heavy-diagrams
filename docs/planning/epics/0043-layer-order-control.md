# 0043: Layer order (z-height) control

## Status
Not Started — not yet scoped. Raised by the user (2026-08-20) while reviewing the C4 gallery diagrams. Deliberately not designed here, just captured so it isn't lost, same as epics 0024/0026/0030/0037/0038/0039/0040. Explicitly told not to build yet.

## Goal
A way to control the stacking order of canvas objects (which one renders on top when two overlap) — not just a blind "bring to front" action, but real visibility into what's currently stacked where. The user's own framing: "a view that lets me see each object and their z height."

## Relevant existing behavior
There's currently no explicit layering concept anywhere in this app or `docs/file-format.md`. Paint order is implicit: React Flow renders `nodes`/`edges` in array order (later in the array paints on top), and a handful of ad hoc `z-index` CSS values exist for UI chrome (context menu at 50, icon picker at 30, highlight chips at 5, etc. — `main.css`) but nothing exposed to the user as a concept they can see or control for diagram content itself. Containers additionally have a real ordering *requirement*, not just a convention: `docs/file-format.md` requires a parent node to appear earlier in the `nodes` array than its children (React Flow's own constraint) — any layering feature needs to not break that.

## Real open questions (deliberately not resolved here)
- **Persisted explicit z-index, or just array-order reordering?** A real per-node/edge z-index field would be a `docs/file-format.md` schema addition (a new optional field, additive per this format's own versioning conventions) and the more intention-revealing option, but reordering the underlying `nodes`/`edges` arrays needs no schema change at all, since React Flow already paints by array order. The tradeoff: array-order-as-layering is more brittle to reason about (e.g. does moving a node in an unrelated edit silently change its layer?) but costs nothing to add.
- **What the visibility view actually looks like** — a dedicated panel (matching the existing Diagnostics/Required-tags/Highlights panel pattern), a Figma-style layers/outliner list, something else? The user asked for the ability to *see* every object and its current position, not just reorder blindly — that's the harder, more novel part of this request, not the reordering mechanism itself.
- **Scope** — nodes only, or edges too? Interaction with containers' existing parent-before-children ordering requirement needs care either way.
- ~~**Relationship to epic 0042**~~ — resolved: [0042](0042-edge-label-behind-edge.md) shipped (2026-08-21) as an unrelated CSS z-index bug ([ADR 0030](../../decisions/0030-edge-label-z-index-override.md)), not a symptom of the missing general layering model this epic is about. No longer an open question here.

## Notes
Next up in the batch (see [PROGRESS.md](../../../PROGRESS.md)) — first epic in the "Canvas" group, once epic 0040 merges. Still not yet scoped; the real open questions above (persisted z-index vs. array-order, what the visibility view looks like, node/edge/container scope) need a design conversation before implementation starts, same as epics 0037/0040 did.

**2026-08-20: [epic 0046](0046-edge-selection-highlight-and-priority.md), also just logged, wants a selected edge to take grab priority over overlapping edges** — a narrower, interaction-specific instance of the general layering problem this epic is about. Worth checking once either gets scoped whether one subsumes the other.
