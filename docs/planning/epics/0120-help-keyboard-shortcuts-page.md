# 0120: Help → Keyboard shortcuts & gestures page (from a single registry)

## Status
Not Started — logged 2026-09-19 as a side-note from the copy-style discussion
([epic 0121](0121-copy-style-apply-mode.md)).

## Goal
A page under the Help menu listing every hotkey **and mouse gesture** the app
supports, with a one-line description each, shown with the right modifier for
the OS (Ctrl on Windows/Linux, Cmd on Mac).

## Design constraint (the real work)
Shortcuts are currently hard-coded inline in one big `keydown` handler in
`Canvas.tsx` (`mod && event.key === 's'`, …), plus separate menu-bar labels.
A hand-written help page would drift from that on the first change. So the
epic is really: **introduce a small shortcut/action registry** (id, keys,
description, category, handler-or-reference) that the keydown handler, the
menu bar's accelerator labels, and the Help page all read.

That registry is also the foundation for the command palette
([epic 0127](0127-command-palette.md)), which is why the registry needs an
"available now" predicate and human-readable titles from the start.

## Scope
- Keyboard: existing set (save/open/new/close/find/select-all/duplicate/
  copy/cut/paste/undo/fit-view/Esc/Delete…) as found in `Canvas.tsx`.
- Gestures: Ctrl/Cmd+click follow link, Shift+click multi-select, right-click
  menu, drag-from-connector to create, drag-from-palette, Ctrl+F search, etc.
- Grouped by category; searchable is a nice-to-have, not required.
- Linux/Windows/Mac display differences ([CLAUDE.md](../../../CLAUDE.md)
  cross-platform rule).

## Tasks
- [ ] Inventory all current shortcuts/gestures (Canvas.tsx keydown handler, MenuBar, node components)
- [ ] Registry module + migrate the keydown handler to read it
- [ ] Help → Keyboard shortcuts dialog/page
- [ ] New features (0119, 0121) register through it from day one
