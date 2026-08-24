# 0082: Select all elements of a type

## Status
Not Started

## Goal
Let the user select every element of a given type (e.g. "all edges") in one action, so a bulk style/property change can be applied to all of them at once via the existing property panel — instead of shift-clicking each one individually. Raised by the user while testing drag-to-select on a large diagram; not scoped further yet (exact trigger — menu item, keyboard shortcut, right-click option — still open).

## Tasks
- [ ] Decide the trigger UI (top menu item under Edit? right-click context menu on an element of that type — "Select all edges"? a keyboard shortcut?)
- [ ] Decide scope: all edges / all shapes / all containers / all text, or more granular (e.g. "all edges with this routing style")?
- [ ] Implement selection logic (reuse existing `setNodes`/`setEdges` selection-toggle patterns already in `Canvas.tsx`)

## Notes
Logged 2026-08-24, mid-session while investigating an unrelated drag-to-select performance issue on the Meridian Rail landscape (see [known-issues.md](../../known-issues.md)) — not related to that bug, just came up in the same conversation.
