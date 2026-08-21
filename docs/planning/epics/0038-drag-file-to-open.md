# 0038: Drag file into window to open

## Status
Not Started — not yet scoped. Raised by the user (2026-08-20). Deliberately not designed here, just captured so it isn't lost, same as epics 0024/0026/0030/0037.

## Goal
Drop a `.chd` file onto an open app window to open it, as an alternative to the existing File → Open dialog.

## Relevant existing behavior
- One `BrowserWindow` per diagram, no tabs — see [ADR 0023](../../decisions/0023-multi-window-diagram-model.md) and [epic 0024](0024-multi-diagram-tabs-or-windows.md).
- File → Open already has a "reuse the current window instead of opening a new one, but only if that window is completely empty" rule (epic 0024's post-merge amendment) — the natural precedent for what dropping a file onto a window should do.
- Opening goes through `window.api.openInNewWindow()` / `openOrFocusWindow(path)` in the main process (`windows.ts`) — a drop handler would presumably route into the same path rather than duplicating open logic.

## Real open questions (deliberately not resolved here)
- **Drop onto an empty window vs. one with a diagram already open** — mirror the File → Open rule above (reuse if empty, new window otherwise), or always open a new window regardless? Also: does dropping onto a window that already has *unsaved changes* need a warning, or does the multi-window model sidestep that since the drop target and the existing diagram are unrelated files?
- **Dropping multiple files at once** — open one window per file, or only honor the first?
- **Non-`.chd` files dropped** — reject with an error, or attempt to read anyway and fail gracefully the same way a corrupt `.chd` would?
- **Electron mechanics** — recent Electron versions removed the renderer's direct `File.path` access for security; getting a real filesystem path from a dropped `File` object now needs `webUtils.getPathForFile` in the preload/main process. Worth confirming which Electron version this project is on and whether that API is available.
- **Drop target scope** — anywhere on the window, or only a specific zone (e.g. not while a text field has focus, so it doesn't interfere with normal text drag-and-drop)?

## Notes
Not scheduled into the current batch (see [PROGRESS.md](../../../PROGRESS.md)) — flagged here so it's on the backlog and not lost, not because it's next up.
