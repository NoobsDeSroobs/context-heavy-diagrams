# 0049: Top menu bar (File / Edit / View / Help)

## Status
Done (2026-08-22). First epic in the App-features batch group, after the Canvas group finished. Raised by the user (2026-08-20), lower urgency than most of the backlog at capture time.

## Goal
Move Open / Save / Save As / Reload and similar actions out of the current single-row toolbar into a conventional desktop-app top menu bar with classic categories — File, Edit, View, Help, etc.

## Relevant existing behavior
Confirmed by reading the code: this app has **no native menu at all** — `src/main/index.ts` never touches Electron's `Menu`/`MenuItem` API. Every action (New, Open, Save, Save As, Reload — epic 0041, Undo, Redo, Required tags, Diagnostics, Highlights) is a plain `<button>` in one horizontal `.toolbar` div in `Canvas.tsx`, and several already have keyboard shortcuts wired independently in a single `onKeyDown` handler (epic 0018) — Ctrl/Cmd+S/O/N/A/D/Z/0, etc.

## Real open questions (deliberately not resolved here)
- **Native Electron menu vs. custom-built renderer menu bar.** Electron's own `Menu.setApplicationMenu()` gives a real OS-level menu (native look, standard accelerator/keyboard-shortcut handling, platform-appropriate placement — top of the OS window on Windows/Linux, the system menu bar on macOS) but means duplicating today's toolbar logic into main-process menu templates and IPC. A custom in-renderer bar styled to look like one gives more direct control and reuses existing renderer-side handlers as-is, at the cost of reimplementing menu-bar behavior (keyboard navigation, accessibility) that native menus get for free. This is a real architectural fork, not an implementation detail — worth deciding explicitly.
- **Multi-window interaction.** This app is one `BrowserWindow` per diagram (ADR 0023) — does each window get independently-correct menu state (e.g. Undo/Redo enabled reflecting *that* window's own undo stack), and if using Electron's native application-level menu (which is normally global, not per-window), how does that reconcile with per-window state at all?
- **Existing keyboard shortcuts** — do they move to become the menu items' accelerators (native menu path), stay as an independent `onKeyDown` handler alongside the menu (custom path), or risk double-handling if both exist? Needs a clear answer either way, not just "figure it out during implementation."
- **Relationship to epic 0048** (left tool sidebar, raised in the same message) — these two together imply a real reorganization of where every current toolbar button ends up, not two independent changes. Worth a single information-architecture decision covering both rather than designing this one in isolation.

## What was built
See [ADR 0039](../../decisions/0039-top-menu-bar.md) for the full reasoning. Answers to the real open questions above:
- **Native vs. custom**: custom in-renderer bar, the user's own call once the tradeoff was laid out (styling/UX flexibility later, matches this app's fully custom UI elsewhere).
- **Multi-window state**: moot under the custom path — every menu item just reads this window's own React state directly (`past.length`, `future.length`, `currentPath`, etc.), no cross-window reconciliation needed at all.
- **Keyboard shortcuts**: kept the existing `onKeyDown` handler unchanged; menu items show the existing accelerators as labels only (no separate registration), plus one new one — Ctrl+W for the new Close item.
- **Relationship to epic 0048**: resolved together — File/Edit/View here, Highlights/Legend (and eventually Required tags/Diagnostics/Layers/Settings, if epic 0048 revisits them) in the future left sidebar. Concretely for this pass: Required tags/Diagnostics/Layers/Settings stayed in View rather than waiting on 0048; only Highlights moved out, since it already had a ready-made destination (Legend's own floating-popup pattern) that didn't require 0048 to exist first.

Also decided, not originally an open question: **File → Close doesn't close the OS window** — corrected by the user after my first pass got it wrong (see ADR 0039's Alternatives). It resets the current window to a blank diagram instead, reusing `loadDiagramIntoCanvas`.

**A real interaction bug in the menu bar's hover-switch** (clicking a different top-level menu while one was already open just closed everything instead of switching) was caught and fixed before this shipped — see ADR 0039's Decision section for the root cause (a click gesture's `mouseenter` always fires before its `click`, racing the toggle logic).

## Verification
Clean typecheck/lint (one pre-existing, unrelated lint error in `Canvas.tsx`, epic 0028). The hover-switch bug was found via careful instrumented testing (temporary `console.log` in the component, read back via the Browser pane's console) after the Browser pane's own automated clicks gave inconsistent results across attempts — not fully trusted as a testing method for hover-timing-sensitive interactions, consistent with this project's prior notes on that limitation. File → Close's new behavior (reset to blank) reuses `loadDiagramIntoCanvas`, already exercised by every other load path, but wasn't independently re-verified live in this session — the dev server became unreachable partway through (likely mid-restart from the main-process IPC changes) and didn't come back up in-session. Worth a direct check: Close with unsaved changes (confirm dialog should appear), Close on an empty canvas (no dialog), and the menu switching behavior generally.

## Notes
Lower urgency than most of the rest of the backlog at capture time, per the user's own framing — built now as the first App-features epic once the sequenced batches reached it.
