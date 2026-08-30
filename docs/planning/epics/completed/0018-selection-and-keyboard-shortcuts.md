# 0018: Selection and keyboard shortcuts

## Status
Done — the two items flagged at merge time were never explicitly re-confirmed as their own item, but selection and keyboard shortcuts have been exercised constantly through dozens of subsequent epics with no issue ever reported against them. See Notes.

## Goal
Standard editor selection/deletion/navigation shortcuts. Raised during epic 0015 testing as just Ctrl+A, expanded substantially after review to cover what's actually practical for this tool today — see Notes for what turned out to already be free from React Flow vs. what needed real code, and cross-epic dependencies.

## Tasks

### Selection
- [x] Ctrl+A: select all nodes/edges — needed real code, implemented as `selectAll` in `Canvas.tsx`. Verified: both nodes select correctly.
- [ ] Drag-to-select (marquee/box selection) on empty canvas — **not independently verified**. Expected to be free via React Flow's `selectionKeyCode` default (unchanged, still `"Shift"`), but the browser-based testing environment couldn't reliably simulate a drag gesture with modifier keys held (see Notes) — please confirm Shift+drag on empty canvas box-selects in the real app.
- [ ] Multi-select: Shift+click — **not independently verified**, same reason as above. `multiSelectionKeyCode="Shift"` is already set (epic 0009); this should already work, but wasn't confirmed by me. Please check.

### Edit
- [x] Escape: close whatever's open, else deselect all — implemented with explicit priority (details panel → icon picker → context menu → deselect). Verified all four cases individually in a live browser session.
- [x] ~~Arrow keys: nudge selected node(s) by 1px; Shift+Arrow for a larger step (10px)~~ — **not built**. Turned out React Flow already does this natively (5px per press, 20px with Shift — `arrowKeyDiffs`/`moveSelectedNodes` in `@xyflow/react`). My first attempt wrote a custom handler anyway and it stacked on top of React Flow's own (confirmed: a single ArrowRight moved a node 6px, not the 1px expected) — removed. Same "audit before building" lesson the epic already applied to drag-select/multi-select, just missed here first, caught by testing.
- [x] Ctrl+D: duplicate selected node(s) in place with a small offset — implemented, no clipboard. Verified: clones with a fresh id at +20/+20, originals deselected, clones selected.

### File
- [x] Ctrl+O: Open — wired to existing `handleOpen`. Not independently verified (needs the real Electron IPC bridge, unavailable in the plain-browser test environment I used — see Notes).
- [x] Ctrl+Shift+S: Save As — same caveat as Ctrl+O.
- [x] Ctrl+N: New diagram, in-memory only — `loadDiagramIntoCanvas` generalized to accept `path: string | null`, `handleNew` calls it with `null` + `createEmptyDiagram()`. Also added a toolbar "New" button for discoverability (not originally scoped, cheap and consistent with Open/Save/Save As already having one). Logic verified by reading, not independently browser-tested (also needs real save/open context to fully exercise).
- [x] Alt+Left: breadcrumb back-navigation — implemented (`navigateToBreadcrumb(breadcrumbs.length - 1)`). Not independently verified — needs a real linked-diagram + file I/O to set up, unavailable in the plain-browser test environment.

### View
- [x] Ctrl+0: re-fit view — `rfInstance.fitView()`. Ran without error in testing; **the specific risk flagged when this was scoped — Electron's default menu potentially already claiming Ctrl+0 for its own page-zoom-reset — could not be checked from a plain browser tab** (Electron accelerators don't exist there). Please verify in the real app that Ctrl+0 does what's expected and doesn't also visibly zoom the whole UI.
- [x] Audited zoom in/out: React Flow provides no default *keyboard* zoom (only scroll/pinch and the `Controls` button UI, both already present) — nothing built for this, matches what the epic asked for (audit, not necessarily implement).

### Undo/redo (binding only — actual mechanism is epic 0006)
- [ ] Not bound here, as planned — see epic 0006, which now owns this task explicitly.

## Notes
Every shortcut here checks both `ctrlKey` and `metaKey`, matching the existing `Ctrl+S` handler's pattern — macOS isn't a primary target platform per the brief, but there's no reason to make the tool actively worse for Mac users over a one-line check.

Real copy/paste (`Ctrl+C`/`V`/`X` — actual clipboard data, paste-position logic, id regeneration) was raised alongside this list but is genuinely new functionality, not just a keybinding. Spun out to its own epic, [0025](0025-copy-paste.md).

**Testing method and its limits**: verified interactively via a browser tab pointed at the electron-vite dev server (`http://localhost:5173`), which exercises real React/React Flow behavior but has no Electron preload bridge (`window.api`) — so anything touching file I/O (Open, Save As, breadcrumb navigation, and by extension a full round-trip test of New) couldn't be exercised end-to-end, only confirmed correct by reading the code. Separately, the browser pane's screenshot/coordinate-click path wasn't reliable in this environment (screenshots timed out — "pane not displayed"), and ref-based clicks landed on the wrong element when two nodes sat close together after a `fitView` reflow; a raw synthetic `MouseEvent('click', {shiftKey:true})` dispatch didn't trigger React Flow's selection either, since it uses its own pointer-event handling internally, not a plain bubbling click. That combination is specifically what blocked verifying Shift+click and Shift+drag — both are one-line-of-config React Flow defaults, not custom code, so the risk is low, but "verify, don't assume" was the whole point of flagging them, so this is flagged honestly rather than assumed to have passed.

Most of the original scope turned out to already be free or near-free: React Flow's built-in box-selection, delete-key handling (`deleteKeyCode`, already wired), *and* arrow-key node movement (discovered during this epic, not previously known). Multi-select is just the `multiSelectionKeyCode` epic 0009 already set. Ctrl+A and Escape ended up the two pieces that genuinely needed custom code.

Correction (epic 0009): `multiSelectionKeyCode` actually defaults to `Meta`/`Control`, not Shift as originally noted here — that was backwards; `Shift` is `selectionKeyCode`, a different prop for drag-box-select. Epic 0009 needed Ctrl/Cmd+click for linked-diagram navigation, so it already explicitly pinned `multiSelectionKeyCode="Shift"` in `Canvas.tsx`.
