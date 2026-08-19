# 0029: Drag-to-add from the item panel

## Status
Not Started — backlogged, not yet scoped in detail

## Goal
Let the item panel (epic 0003's in-diagram dock, default/no-selection content) support dragging a shape/container/text icon directly onto the canvas and dropping it at that exact position — the standard "stencil palette" interaction from tools like Visio/draw.io — as an addition to click-to-add (which epic 0003 ships first).

## Tasks
(Not broken down yet — split out from epic 0003 on 2026-08-19 specifically so the panel could ship with click-to-add first, without blocking on the extra implementation work here: HTML5 drag events from the panel, translating the drop's screen position into canvas/flow coordinates via `screenToFlowPosition`, and deciding how it interacts with a container under the drop point — presumably drops *into* a container the same way `onNodeDragStop`'s intersection check already handles for existing nodes, epic 0004.)

## Notes
User wants both interactions eventually (click for fast/keyboard-friendly placement, drag for precise placement) — this isn't a rejection of drag-to-add, just a sequencing call to ship the simpler one first.
