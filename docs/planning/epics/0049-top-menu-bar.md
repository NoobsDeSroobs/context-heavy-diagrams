# 0049: Top menu bar (File / Edit / View / Help)

## Status
Not Started — not yet scoped, and explicitly lower urgency than most of the backlog ("at some point we should take a look"). Raised by the user (2026-08-20). Deliberately not designed here, just captured so it isn't lost, same as epics 0024/0026/0030/0037-0048. Explicitly told not to build yet.

## Goal
Move Open / Save / Save As / Reload and similar actions out of the current single-row toolbar into a conventional desktop-app top menu bar with classic categories — File, Edit, View, Help, etc.

## Relevant existing behavior
Confirmed by reading the code: this app has **no native menu at all** — `src/main/index.ts` never touches Electron's `Menu`/`MenuItem` API. Every action (New, Open, Save, Save As, Reload — epic 0041, Undo, Redo, Required tags, Diagnostics, Highlights) is a plain `<button>` in one horizontal `.toolbar` div in `Canvas.tsx`, and several already have keyboard shortcuts wired independently in a single `onKeyDown` handler (epic 0018) — Ctrl/Cmd+S/O/N/A/D/Z/0, etc.

## Real open questions (deliberately not resolved here)
- **Native Electron menu vs. custom-built renderer menu bar.** Electron's own `Menu.setApplicationMenu()` gives a real OS-level menu (native look, standard accelerator/keyboard-shortcut handling, platform-appropriate placement — top of the OS window on Windows/Linux, the system menu bar on macOS) but means duplicating today's toolbar logic into main-process menu templates and IPC. A custom in-renderer bar styled to look like one gives more direct control and reuses existing renderer-side handlers as-is, at the cost of reimplementing menu-bar behavior (keyboard navigation, accessibility) that native menus get for free. This is a real architectural fork, not an implementation detail — worth deciding explicitly.
- **Multi-window interaction.** This app is one `BrowserWindow` per diagram (ADR 0023) — does each window get independently-correct menu state (e.g. Undo/Redo enabled reflecting *that* window's own undo stack), and if using Electron's native application-level menu (which is normally global, not per-window), how does that reconcile with per-window state at all?
- **Existing keyboard shortcuts** — do they move to become the menu items' accelerators (native menu path), stay as an independent `onKeyDown` handler alongside the menu (custom path), or risk double-handling if both exist? Needs a clear answer either way, not just "figure it out during implementation."
- **Relationship to epic 0048** (left tool sidebar, raised in the same message) — these two together imply a real reorganization of where every current toolbar button ends up, not two independent changes. Worth a single information-architecture decision covering both rather than designing this one in isolation.

## Notes
Not scheduled into the current batch (see [PROGRESS.md](../../../PROGRESS.md)) — flagged here so it's on the backlog and not lost, not because it's next up. Lower urgency than most of the rest of the backlog, per the user's own framing.
