# 0006: Undo / redo

## Status
Not Started

## Goal
Undo/redo over a reasonable number of steps (not unlimited/branching for v1).

## Tasks
- [ ] Simple state-snapshot stack over `{nodes, edges}`
- [ ] Snapshot per completed action, not per pixel-drag (keeps history usable and memory-bounded)
- [ ] Keyboard shortcuts (Ctrl/Cmd+Z, Shift+Ctrl/Cmd+Z)
