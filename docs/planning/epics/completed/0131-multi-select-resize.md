# 0131: Multi-select resize scales every selected node

## Status
Implemented (2026-09-23), live-tested on Windows by the user (2026-09-24; Linux unverified), merged (#104). See [ADR 0098](../../decisions/0098-multi-select-resize-percentage-scaling.md). `typecheck`/`lint`/`npm test` — see Tasks. From the first external feature request (the second half; the first, alt-drag duplicate, is [0132](0132-alt-drag-duplicate.md)).

## Goal
With several nodes selected, dragging any one node's resize handle resizes all of them by the same percentage, each in place — no reflow of the layout.

## Tasks
- [x] Design: percentage scaling, anchored to the same edge as the dragged node — ADR 0098
- [x] Pure `scaleGroupMembers` in `src/renderer/src/groupResize.ts` + 3 unit tests
- [x] `groupResize` start/resize/end callbacks in `Canvas.tsx`, threaded via `DiagramContext`
- [x] Wire `NodeResizer` in `ShapeNode`, `ContainerNode`, `TextNode`
- [x] `typecheck` / `lint` / `npm test` (88 tests, 0 lint errors)
- [x] Live test in the Electron renderer (user, Windows): right/bottom/corner/left/top handles; a member hitting its minimum then recovering; a locked node in the selection stays put; a selected container + its children; single-node resize unchanged; undo restores every node in one step

## Notes
No `.chd` schema change — sizes were already persisted per node — so `docs/file-format.md` is untouched.

Live testing found two follow-ups, both fixed on the branch: the anchored edge flipped when the drag reversed ([ADR 0098](../../decisions/0098-multi-select-resize-percentage-scaling.md) addendum), and React Flow's multi-selection overlay rectangle sat over the handles, so it is now hidden via CSS in `main.css` (drag-by-empty-space inside the selection no longer works; dragging a selected shape still moves the whole selection).
