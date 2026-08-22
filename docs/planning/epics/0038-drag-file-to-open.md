# 0038: Drag file into window to open

## Status
On hold, blocked by [epic 0020](0020-autosave-and-crash-recovery.md) (2026-08-22). Raised by the user (2026-08-20). Design conversation started 2026-08-22 and got as far as resolving most of the open questions below before hitting a real blocker: dropping onto a non-empty window needs to distinguish "saved, no changes" from "genuinely unsaved" to prompt correctly, and this app has no dirty-tracking at all yet — that's epic 0020's own scope. Rather than build a throwaway one-off dirty check here, epic 0020 was pulled forward as a prerequisite (see its doc and [ADR 0040](../../decisions/0040-dirty-tracking-and-autosave-design.md)). Resume this epic once 0020 lands.

## Resolved during the 2026-08-22 design conversation (not yet built)
- **Drop onto an empty window**: open directly, no prompt — same "nothing to lose" reasoning as `handleOpen`'s window-reuse check.
- **Drop onto a non-empty window**: depends on dirty state (blocked on epic 0020) — saved/clean prompts Open Here vs. Open in New Window; genuinely unsaved prompts New Window / Open Here (discard) / Cancel.
- **A file already open in another window**: focus that window instead, regardless of the drop target's own state — same precedent `openOrFocusWindow` already uses for File → Open.
- **Multiple files dropped at once**: one window per file. Only the actual drop-target window's state (per the point above) is ever in question — every additional file just opens its own new window unconditionally, since there's no second window to reuse or prompt about.
- **Non-`.chd` files dropped**: reject upfront by extension, matching the file dialog's own filter — no attempt to read and fail gracefully.

## Goal
Drop a `.chd` file onto an open app window to open it, as an alternative to the existing File → Open dialog.

## Relevant existing behavior
- One `BrowserWindow` per diagram, no tabs — see [ADR 0023](../../decisions/0023-multi-window-diagram-model.md) and [epic 0024](0024-multi-diagram-tabs-or-windows.md).
- File → Open already has a "reuse the current window instead of opening a new one, but only if that window is completely empty" rule (epic 0024's post-merge amendment) — the natural precedent for what dropping a file onto a window should do.
- Opening goes through `window.api.openInNewWindow()` / `openOrFocusWindow(path)` in the main process (`windows.ts`) — a drop handler would presumably route into the same path rather than duplicating open logic.

## Real open questions still remaining
- **Electron mechanics** — confirmed the project is on Electron 43.4.0 (2026-08-22 check), well past `webUtils.getPathForFile`'s introduction (Electron 32), so that API is available for getting a real filesystem path from a dropped `File` object. Not yet actually wired up.
- **Drop target scope** — anywhere on the window, or only a specific zone (e.g. not while a text field has focus, so it doesn't interfere with normal text drag-and-drop)? Leaning "whole window, no special-casing" since file drops and in-page text drags are different browser mechanisms that don't typically conflict — not confirmed with the user, low-stakes enough to decide during implementation rather than needing a design conversation.

## Notes
Not scheduled into the current batch (see [PROGRESS.md](../../../PROGRESS.md)) — on hold behind epic 0020, not dropped.
