# 0038: Drag file into window to open

## Status
Implemented (2026-08-22) on `epic/0038-drag-file-to-open`, not yet live-tested or merged. Raised by the user (2026-08-20), resumed once epic 0020's dirty-tracking landed. See [ADR 0040](../../decisions/0040-dirty-tracking-and-autosave-design.md) for why 0020 had to come first.

## Resolved during design, now built
- **Drop onto an empty window**: open directly, no prompt — same "nothing to lose" reasoning as `handleOpen`'s window-reuse check.
- **Drop onto a non-empty window** — revised same-day after the first live-testing pass, see Notes: clean (saved, no changes) prompts **Open Here / New Window / Cancel**; dirty prompts **Save changes, Open Here / Discard changes, Open Here / New Window / Cancel**. Every button names its own consequence explicitly (the first pass's bare "Open Here" for a discard was found misleading), both branches have a real Cancel (the first pass's clean branch didn't), and the message states the window's dirty state outright. Save reuses the exact same save flow as the close-prompt's own Save option (`performSaveNow`, shared between both), not a duplicate. Discarding cleans up any pending recovery snapshot for the old identity first, mirroring the close-prompt's own Discard behavior (epic 0020).
- **A file already open in another window**: focus that window instead, regardless of the drop target's own state — same precedent `openOrFocusWindow` already uses for File → Open.
- **Multiple files dropped at once**: one window per file. Only the actual drop-target window's state (per the point above) is ever in question — every additional file just opens its own new window (or focuses an existing one) unconditionally.
- **Non-`.chd` files dropped**: rejected upfront by extension before anything reaches main — an alert if *every* dropped file gets rejected (nothing to open at all), silent filtering if some valid files remain in a mixed drop.
- **Electron mechanics**: `webUtils.getPathForFile(file)`, called from the preload script (synchronous, no IPC round-trip needed just to resolve a path) — confirmed available on this project's Electron 43.4.0.
- **Drop target scope**: whole window (`window.addEventListener` on `dragenter`/`dragover`/`drop`), no special-casing — React Flow's own node dragging uses pointer events, not the HTML5 Drag-and-Drop API, so the two mechanisms never compete for the same gesture.

## Implementation notes
- `src/main/windows.ts`: new `openDroppedFileForWindow` (the drop-target's own empty/clean/dirty decision tree) and `windows:handleDroppedFiles` IPC handler (first path through that decision tree, every other path through the existing `openOrFocusWindow`). Dirty branch's Save option round-trips to the renderer via `window:performSaveThenOpenDropped` / `windows:confirmSavedThenOpen`, since main can't perform a save itself.
- Preload exposes `getPathForFile` (sync) and `handleDroppedFiles` (async, mirrors the renderer's own `isDirty`/`currentPath`/`sessionId`/empty-check state to main, the same pattern epic 0020's close-choreography already established), plus the save-round-trip pair above.
- `Canvas.tsx`: a window-level `dragenter`/`dragover`/`drop` listener effect, refs for the latest dirty/path/nodes/edges state (subscribes once, same pattern as the autosave timer and close-check listener). `performSaveNow` extracted as a shared helper — both the close-prompt's Save option and the drop-prompt's Save & Open Here option call it, rather than duplicating "pick a path if none yet, then persist."

## Goal
Drop a `.chd` file onto an open app window to open it, as an alternative to the existing File → Open dialog.

## Relevant existing behavior
- One `BrowserWindow` per diagram, no tabs — see [ADR 0023](../../decisions/0023-multi-window-diagram-model.md) and [epic 0024](0024-multi-diagram-tabs-or-windows.md).
- File → Open already has a "reuse the current window instead of opening a new one, but only if that window is completely empty" rule (epic 0024's post-merge amendment) — the natural precedent for what dropping a file onto a window should do.
- Opening goes through `window.api.openInNewWindow()` / `openOrFocusWindow(path)` in the main process (`windows.ts`) — a drop handler would presumably route into the same path rather than duplicating open logic.

## Notes
Typecheck and lint clean; confirmed the app boots without a startup exception via a throwaway `npm run dev` run. **Not yet exercised interactively** — real drag-and-drop from Windows Explorer, the native dialog choices, and the recovery-cleanup-on-discard path all need the user's own hands-on testing; the Browser pane's automation can't drive OS-level file drag gestures or Electron's native dialogs.
