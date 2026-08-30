# 0029: Drag-to-add from the item panel

## Status
Done, implemented (2026-08-27), on `epic/0029-drag-to-add-from-item-panel`, pending live test/merge. `typecheck`/`lint` clean (same 4 pre-existing baseline errors, no new warnings in new/touched files).

## Goal
Let the item panel (epic 0003's in-diagram dock, default/no-selection content) support dragging a shape/container/text icon directly onto the canvas and dropping it at that exact position — the standard "stencil palette" interaction from tools like Visio/draw.io — as an addition to click-to-add (which epic 0003 ships first).

## What shipped
Every `ItemPalette` button (`panels/ItemPalette.tsx`) is now `draggable` alongside its existing `onClick`, both interactions available side by side as the Notes below always intended. Dragging one onto the canvas (`onDragOver`/`onDrop` on the flow wrapper div in `Canvas.tsx`) places the new node centered under the drop point via a new `addNodeAtPosition` function, and reparents it into whichever container the drop point lands inside — see [ADR 0064](../../../decisions/0064-drag-to-add-container-detection.md) for why that container-detection had to be done manually (point-containment against each container's own computed bounds, highest-`zIndex` wins if nested) rather than reusing `onNodeDragStop`'s `getIntersectingNodes` call, which only works on a node React Flow already has registered — not true yet for a node this same drop is in the middle of creating. Click-to-add's four existing `addXNode` callbacks are untouched; `addNodeAtPosition` is a new, separate function, per the ADR's reasoning.

## Notes
User wants both interactions eventually (click for fast/keyboard-friendly placement, drag for precise placement) — this isn't a rejection of drag-to-add, just a sequencing call to ship the simpler one first.
