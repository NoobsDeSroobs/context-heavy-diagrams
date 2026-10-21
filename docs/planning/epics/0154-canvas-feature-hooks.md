# 0154: Canvas feature hooks

## Status
Not Started. Follows [0153](0153-hook-and-component-tests.md). Design: [ADR 0126](../../decisions/0126-canvas-features-are-hooks-that-own-their-state.md).

## Goal
Take the features out of `CanvasInner` into hooks that own their state, so `Canvas.tsx` shrinks from about 5,000 lines of logic to the core (roughly 2,500 to 3,000 lines in total).

## Tasks
- [ ] Define `CanvasApi` and extract the core hooks: undo/redo (`pushSnapshot`, begin/end continuous edit) and dirty tracking
- [ ] Leaf feature hooks, one commit each: search, references, style brush and legend line pick, legend, highlights, missing files and diagnostics, edge direction sets, threat matrix, panel open/close state
- [ ] Document I/O (save, load, open, close, autosave, recovery, external change; about 1,100 lines), last of the heavy pieces
- [ ] Move the menu and palette-action builders (about 530 lines) out of `Canvas.tsx`
- [ ] Update the "not split further" sentence in `docs/architecture/overview.md`
- [ ] Decide whether node creation and the connect/drag handlers (the most entangled part) are split too

## Notes
Moves are verbatim, with the hook's return destructured into the same local names so the JSX does not change in the same commit. Measured coupling (2026-10-22): each leaf feature uses 3 to 11 outside names, mostly `rfInstance`, `pushSnapshot`, `markDirty`, `currentPath`, `graphRef`. Tests from 0153 run after each commit; the maintainer smoke-tests after the first four hooks and after document I/O.
