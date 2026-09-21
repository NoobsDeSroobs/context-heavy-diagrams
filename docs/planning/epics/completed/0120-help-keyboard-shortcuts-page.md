# 0120: Help → Keyboard shortcuts & gestures page (from a single command registry)

## Status
Implemented 2026-09-20 on `epic/0120-help-keyboard-shortcuts-page`
([ADR 0094](../../../decisions/0094-command-registry-and-shortcuts-help.md));
`typecheck`/`lint`/`npm test` clean, **not live-tested** (Electron renderer;
Linux/Mac display unverified). Logged 2026-09-19 as a side-note from the
copy-style discussion ([epic 0121](0121-copy-style-apply-mode.md)).

## Goal
A page under the Help menu listing every hotkey **and mouse gesture** the app
supports, with a one-line description each, shown with the right modifier for
the OS (Ctrl on Windows/Linux, Cmd on Mac).

## Design constraint (the real work)
Shortcuts are currently hard-coded inline in one big `keydown` handler in
`Canvas.tsx` (`mod && event.key === 's'`, …), plus separate menu-bar labels.
A hand-written help page would drift from that on the first change. So the
epic is really: **introduce a small command registry** (id, keys,
description, category, handler-or-reference) that the keydown handler, the
menu bar's accelerator labels, and the Help page all read.

That command registry is also the foundation for the command palette
([epic 0127](../0127-command-palette.md)), which is why the command registry needs an
"available now" predicate and human-readable titles from the start.

## Scope
- Keyboard: existing set (save/open/new/close/find/select-all/duplicate/
  copy/cut/paste/undo/fit-view/Esc/Delete…) as found in `Canvas.tsx`.
- Gestures: Ctrl/Cmd+click follow link, Shift+click multi-select, right-click
  menu, drag-from-connector to create, drag-from-palette, Ctrl+F search, etc.
- Grouped by category; searchable is a nice-to-have, not required.
- Linux/Windows/Mac display differences ([CLAUDE.md](../../../../CLAUDE.md)
  cross-platform rule).

## Tasks
- [x] Inventory all current shortcuts/gestures (Canvas.tsx keydown handler, MenuBar, node components)
- [x] Command registry module (`src/renderer/src/commands.ts`) + keydown handler and menu accelerators read it
- [x] Help → Keyboard shortcuts dialog (`ShortcutsDialog`, with a filter box)
- [ ] New features (0121) register through it from day one; the peek card (0119) is already listed as a display-only entry
- [ ] Live test: every shortcut still behaves as before (Ctrl+S/Shift+S/O/N/W/F/A/D/C/X/V/Z/Shift+Z/0, Esc chain incl. the new dialog), Ctrl+C on plain selected text still copies, Help → Keyboard shortcuts opens/filters/closes; Cmd labels on Mac

## Notes
- The command palette ([epic 0127](../0127-command-palette.md)) will read the same registry; the "available now" predicate / runtime `run` is left for that epic (ADR 0094).
- Display-only entries (React Flow / component-owned keys and gestures) can still drift from the code they describe — see ADR 0094's Consequences.
