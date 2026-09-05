# 0113: Reverse direction on an edge selection

## Status
Done (2026-09-05), on `epic/0113-reverse-edge-direction-on-selection`, pending live test/merge. See [ADR 0087](../../decisions/0087-reverse-edge-direction-on-selection.md). `typecheck`/`lint` clean.

## Goal
Let the user flip the direction of several edges at once: select a group of edges (by any existing means), then reverse all of them in one action — instead of right-clicking "Reverse direction" on each edge in turn.

## What shipped
- New `reverseEdges(ids)` helper in `Canvas.tsx` — one snapshot, one `setEdges` mapping the pure `reverseEdgeDirection` involution over the id set. One undo step for the whole batch.
- Edge context menu "Reverse direction" is now selection-aware: right-click an edge that's part of a multi-selection → reverses every selected edge (`Reverse direction (N)`); right-click an unselected edge → just that one, selection untouched.
- New Edit-menu item `Reverse edge direction` / `Reverse edge direction (N)`, disabled when no edge is selected — reaches the action without a right-click and after a box/"Select all edges" selection.

## Tasks
- [x] Assess feasibility (done as a pre-implementation assessment — the pure `reverseEdgeDirection`, multi-select, and array-based bulk edit already existed)
- [x] Decide semantics — ADR 0087 (context menu targets the selection only when the right-clicked edge is in it; Edit menu always targets the selection; no panel button / accelerator in v1)
- [x] `reverseEdges(ids)` in `Canvas.tsx`
- [x] Wire the edge context menu
- [x] Wire the Edit menu
- [x] `typecheck` / `lint`
- [ ] Live test in the Electron renderer (user)

## Notes
Grew out of a question about whether a dedicated edge drag-select box was needed. It isn't — React Flow already extends a node box-select to connected edges, and Shift+click / "Select all edges" cover the rest. A true edge-only lasso was explicitly ruled out of scope (ADR 0087): no React Flow primitive, would need custom path hit-testing.

No `.chd` schema change — pure editing action, so `docs/file-format.md` is untouched.
