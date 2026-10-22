# 0154: Canvas feature hooks

## Status
In Progress, branch `epic/0154-canvas-feature-hooks`. Follows [0153](0153-hook-and-component-tests.md). Design: [ADR 0126](../../decisions/0126-canvas-features-are-hooks-that-own-their-state.md). `Canvas.tsx` 6,103 → 5,399 lines so far.

## Goal
Take the features out of `CanvasInner` into hooks that own their state, so `Canvas.tsx` shrinks from about 5,000 lines of logic to the core (roughly 2,500 to 3,000 lines in total).

## Tasks
- [x] Define `CanvasApi` and extract the core hooks: undo/redo (`useHistory`) and dirty tracking (`useDirtyState`)
- [ ] Leaf feature hooks, one commit each: ~~search~~, ~~references~~, ~~style brush and legend line pick~~, legend, highlights, missing files and diagnostics, edge direction sets, threat matrix, panel open/close state
- [ ] Smoke test by the maintainer after the first four hooks (done: history/dirty, search, references, brush/line pick)
- [ ] Document I/O (save, load, open, close, autosave, recovery, external change; about 1,100 lines), last of the heavy pieces
- [ ] Move the menu and palette-action builders (about 530 lines) out of `Canvas.tsx`
- [ ] Update the "not split further" sentence in `docs/architecture/overview.md`
- [ ] Decide whether node creation and the connect/drag handlers (the most entangled part) are split too

## Notes
Moves are verbatim, with the hook's return destructured into the same local names so the JSX does not change in the same commit. Measured coupling (2026-10-22): each leaf feature uses 3 to 11 outside names, mostly `rfInstance`, `pushSnapshot`, `markDirty`, `currentPath`, `graphRef`. A hook's returned setters are stable but lint cannot see that, so they were added to the dependency arrays of the callbacks that use them; the identities are unchanged. A hook that a load resets exposes one `resetX()` instead of Canvas calling every setter (search). The panel open flags stay in `Canvas` until the panel hook, because each toggle closes its siblings. Tests from 0153 run after each commit; the maintainer smoke-tests after the first four hooks and after document I/O.
