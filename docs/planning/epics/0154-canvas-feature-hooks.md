# 0154: Canvas feature hooks

## Status
In Progress, branch `epic/0154-canvas-feature-hooks`. Follows [0153](0153-hook-and-component-tests.md). Design: [ADR 0126](../../decisions/0126-canvas-features-are-hooks-that-own-their-state.md). `Canvas.tsx` 6,103 → 3,890 lines (`wc -l`).

## Goal
Take the features out of `CanvasInner` into hooks that own their state, so `Canvas.tsx` shrinks from about 5,000 lines of logic to the core (roughly 2,500 to 3,000 lines in total).

## Tasks
- [x] Define `CanvasApi` and extract the core hooks: undo/redo (`useHistory`) and dirty tracking (`useDirtyState`)
- [x] Leaf feature hooks, one commit each: search, references, style brush and legend line pick, legend, highlights, missing files and diagnostics, edge direction sets, threat matrix data, panel open/close state and persona
- [x] Smoke test by the maintainer after the first four hooks (history/dirty, search, references, brush/line pick): passed, after a clean dev-server restart
- [x] Smoke test of the second batch of leaf hooks: passed
- [x] Document I/O as five hooks: `useExternalChange`, `useSave`, `useWindowLifecycle` (initial load, recovery, autosave, close prompt, drop), `useDocumentCommands`, `useLinks`. `loadDiagramIntoCanvas` stays in `Canvas`: it is the one place that sets every piece of canvas state, so moving it would only relocate that list
- [x] Maintainer smoke test of document I/O: passed
- [x] Move the menu and palette-action builders out of `Canvas.tsx` (`useMenus.ts`; named `use*` only so the React lint accepts ref-backed handlers being passed in)
- [x] Bring the `canvas`, `links` and `document` rows of `docs/architecture/overview.md` up to date (the "not split further" sentence no longer existed)
- [ ] Decide whether node creation and the connect/drag handlers (the most entangled part) are split too

## Notes
Moves are verbatim, with the hook's return destructured into the same local names so the JSX does not change in the same commit. Measured coupling (2026-10-22): each leaf feature uses 3 to 11 outside names, mostly `rfInstance`, `pushSnapshot`, `markDirty`, `currentPath`, `graphRef`. A hook's returned setters are stable but lint cannot see that, so they were added to the dependency arrays of the callbacks that use them; the identities are unchanged. A hook that a load resets exposes one `resetX()` instead of Canvas calling every setter (search). The panel open flags live in one `usePanels` hook because each toggle closes its siblings; the Changes panel's diff reads the whole diagram, so `Canvas` keeps `computeChangesDiff` and hands it to the hook's `toggleChangesPanelWith`. Tests from 0153 run after each commit; the maintainer smoke-tests after the first four hooks and after document I/O.
