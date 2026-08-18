# 0018: Selection and keyboard shortcuts

## Status
Not Started

## Goal
Standard editor selection/deletion shortcuts. Raised during epic 0015 testing, not part of that epic's scope.

## Tasks
- [ ] Ctrl+A: select all nodes/edges
- [ ] Drag-to-select (marquee/box selection) on empty canvas
- [ ] Ctrl+click for multi-select
- [x] ~~Delete key removes selected nodes/edges~~ — pulled forward into epic [0008](0008-detail-sublayer.md) on explicit request (no way to delete anything at all was blocking testing); done there, not here
- [ ] Probably more — revisit when this epic starts

## Notes
Most of this is likely a config change, not new logic: React Flow has built-in box-selection (`selectionOnDrag`) and delete-key handling (`deleteKeyCode`) already, and multi-select is just picking which modifier key `multiSelectionKeyCode` listens for (defaults to Shift, not Ctrl). Ctrl+A is the one piece that needs real custom code — no built-in "select all."
