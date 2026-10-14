# 0132: Modifier+drag duplicates the dragged selection

## Status
**Done — merged to `master`** (PR #105). Implemented (2026-09-24), live-tested and confirmed working on Windows (2026-09-23). See [ADR 0099](../../decisions/0099-modifier-drag-duplicate.md). `typecheck`/`lint`/`npm test` clean. From the first external feature request ("Alt+drag = duplicate"). Linux behavior still unconfirmed — see [known-issues.md](../../known-issues.md#alt-drag-duplicate-may-be-swallowed-by-linux-window-managers).

## Goal
Holding a modifier while dragging a node (or the selection) leaves the original untouched and drags a fresh copy, like Figma/draw.io.

## Tasks
- [x] Design: hand-off approach, single modifier — ADR 0099
- [x] `useModifierDragDuplicate` hook (capture-phase mouse-down, threshold, replay on the copy)
- [x] `duplicateForDrag` in `Canvas.tsx` (selection + descendants, internal edges, one undo step)
- [x] Shortcuts help entry (`commands.ts`)
- [x] `typecheck` / `lint` / `npm test`
- [x] Live test on Windows (user): Alt+drag one shape; a multi-selection; a container with children; a child inside a container; Alt+click without moving (plain select, no copy); undo removes the copy and restores everything in one step; the original keeps its edges; a locked shape is ignored
- [ ] **Linux (user; logged in known-issues.md):** confirm whether the window manager swallows Alt+drag; if so switch `DUPLICATE_DRAG_MODIFIER` to `'ctrlKey'` (one line) and change the label in `commands.ts`

## Notes
The modifier question was left open by the user; shipped as **Alt** (as requested) behind one constant. No `.chd` schema change.
