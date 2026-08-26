# 0082: Select all elements of a type

## Status
Done (2026-08-27), on `batch/2026-08-27-backlog-cleanup`, pending live test/merge. See [ADR 0065](../../decisions/0065-select-all-of-type.md) for how the two open questions below were resolved. `typecheck`/`lint` clean (0 errors project-wide).

## What shipped
A "Select all shapes"/"...containers"/"...text"/"...lines"/"...edges" item in each type's own right-click context menu — replaces the current selection outright, whole-type only (no finer filtering). Lines are the one exception: reachable via a point's context menu, not the line body's, since right-clicking the body already does something else (adds a bend point). New `selectAllOfType()` in `Canvas.tsx`, threaded through `DiagramContext`.

## Goal
Let the user select every element of a given type (e.g. "all edges") in one action, so a bulk style/property change can be applied to all of them at once via the existing property panel — instead of shift-clicking each one individually. Raised by the user while testing drag-to-select on a large diagram; not scoped further yet (exact trigger — menu item, keyboard shortcut, right-click option — still open).

## Tasks
- [x] Decide the trigger UI — right-click context menu, per type, see [ADR 0065](../../decisions/0065-select-all-of-type.md)
- [x] Decide scope — whole-type only, no finer filtering (deferred)
- [x] Implement selection logic — `selectAllOfType()`, reusing the same `setNodes`/`setEdges` selection-toggle shape `selectAll`/`deselectAll` already used

## Notes
Logged 2026-08-24, mid-session while investigating an unrelated drag-to-select performance issue on the Meridian Rail landscape (see [known-issues.md](../../known-issues.md)) — not related to that bug, just came up in the same conversation.
