# 0006: Undo / redo

## Status
Not Started

## Goal
Undo/redo over a reasonable number of steps (not unlimited/branching for v1). Primarily aimed at three real scenarios: accidental/mistaken deletion, mistaken transformations (move/resize/rotate, and later style/container changes), and "the previous text was better."

## Tasks
- [ ] Full state-snapshot stack over `{nodes, edges}` — deliberately generic (snapshot the whole structure, not per-field change tracking) specifically so it doesn't need revisiting when epics 0003 (styling) and 0004 (containers) add new mutable fields later. Memory/speed cost of full snapshots is an accepted, known risk for v1 — simplest-thing-that-could-work now, revisit only if it's actually a problem in practice.
- [ ] Snapshot per completed action, not per pixel-drag (keeps history usable and memory-bounded)
- [ ] Text edits (labels): snapshot on commit (`EditableLabel`'s existing `onCommit`), not per keystroke — typing itself doesn't need its own undo integration since `EditableLabel` already defers writing to node state until the edit is committed; the overarching undo stack only ever sees the finished value, one step per commit
- [ ] Undo stack scope: per-diagram, reset on `loadDiagramIntoCanvas` (opening a file, navigating a link forward or via breadcrumb) — i.e. never spans two different diagrams. Persisting a stack per open tab across the tab's own lifetime is out of scope here; belongs to whatever epic ends up building tabs/windows (see epic 0024, not yet started) once that exists.
- [ ] Keyboard shortcuts (Ctrl/Cmd+Z, Shift+Ctrl/Cmd+Z or Ctrl+Y — exact redo binding is an open question, see epic 0018) — the actual binding lands as part of this epic even though it was raised while scoping epic 0018, since the shortcut is meaningless without the undo/redo mechanism it drives
