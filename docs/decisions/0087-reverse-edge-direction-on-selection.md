# 0087: "Reverse direction" acts on the whole edge selection

## Status
Decided and implemented (2026-09-05).

## Context

"Reverse direction" existed only as a single-edge right-click action ([ADR 0084](0084-diagnostics-missing-files.md) is unrelated; the reverse action itself came in with the multi-connection-line work and was refactored to the pure `reverseEdgeDirection(edge): Edge` involution alongside per-set edge styling). Flipping several edges meant right-clicking each one in turn.

The user asked for a way to select a group of edges and flip all of them at once — "click-select edges, then right-click any of them to reverse the direction on all."

The pieces to build on were already in place:

- `reverseEdgeDirection` is a pure `Edge → Edge` — swaps `source`/`target` and `sourceHandle`/`targetHandle`, reverses `data.points`, mirrors `data.style.labelPosition`. Mapping it over N edges needs no new logic.
- Multi-edge selection already works (Shift+click; "Select all edges" in the edge context menu; a box-select over nodes, which React Flow extends to every edge touching a selected node).
- Multi-edge editing is already the norm — the property panel's `onUpdateEdgeStyle` takes an array of edge ids.
- `selectedEdges` is already a memoized value in `Canvas.tsx`, passed to the dock.

A true edge-only rubber-band select (a drag box that picks edges whose path it crosses, independent of their nodes) was considered and **rejected as out of scope** — React Flow has no such primitive and it would need custom path-intersection hit-testing, far more than this feature warrants. Selecting edges by any of the means that already exist is enough.

## Decision

**One shared helper, two entry points.**

`Canvas.tsx` gets `reverseEdges(ids: string[])` — one `pushSnapshot()` then a single `setEdges` mapping `reverseEdgeDirection` over the id set. The whole batch is one undo step.

1. **Edge context menu** — the existing "Reverse direction" item becomes selection-aware:
   - Right-clicking an edge that is part of a multi-selection reverses **every selected edge**; the label reads `Reverse direction (N)`.
   - Right-clicking an edge that is **not** selected (whatever else is selected) acts on **just that edge** and leaves the selection untouched — the established "right-click targets what's under the cursor, not an invisible selection" behavior, and identical to today's single-edge case.

2. **Edit menu** — a new `Reverse edge direction` item (`Reverse edge direction (N)` when more than one edge is selected), disabled when no edge is selected, acting on `selectedEdges`. This makes the action reachable without a right-click and once the selection was made by box-select or "Select all edges".

No property-panel button, no keyboard accelerator in v1 — the two menu entries cover discovery from both the canvas and the menu bar; either can be added later without rework.

## Interaction with direction sets

Unchanged from the single-edge case. `reverseEdgeDirection` touches only the live edge fields; when a direction set is active, its per-edge record is refreshed from those fields at the next set switch or save, so a reverse changes only the currently-displayed reading. Reversing N edges is N independent applications of the same involution.

## Alternatives considered

- **A dedicated edge drag-select box** — rejected (see Context): no React Flow primitive, disproportionate effort.
- **Context menu always acts on the selection, even when right-clicking an unselected edge** — rejected as surprising; right-clicking an edge that isn't highlighted should not silently flip a dozen others.
- **Property-panel "Reverse" button** — not in v1; it would mean threading a new callback through `DiagramDock → PropertyPanel → EdgeFields` for a third path to the same action. Cheap to add later if the menu entries prove not discoverable enough.
- **A keyboard accelerator** — deferred; no obvious unclaimed key, and the action isn't frequent enough to justify a non-obvious one.

## Consequences

- No `.chd` schema change — a pure editing action over existing fields.
- `reverseEdges` is the single place the reverse-a-batch behavior lives; the old inline single-edge handler is gone.
- `onEdgeContextMenu` now depends on `edges` (to read the current selection when building the menu) in addition to `nodes`. It is only invoked on right-click, so rebuilding it per edge change costs nothing observable.
