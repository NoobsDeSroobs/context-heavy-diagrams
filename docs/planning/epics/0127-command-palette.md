# 0127: Command palette

## Status
Implemented (2026-09-29), live-tested and confirmed working by the user (2026-09-30), pending PR/merge. See [ADR 0100](../decisions/0100-command-palette-reuses-the-menu-bar.md). `typecheck`/`lint`/`npm test` clean (93 tests). From the plan to do the shape-to-concept rename ([epic 0076](0076-rename-shape-to-concept.md)) right after this one.

## Goal
A keyboard-invoked, searchable launcher for app actions (type "export png",
"open diagnostics" → Enter). It is a different thing from
the Help → shortcuts page (a static reference), but both read the same command registry.

## Why it earns its place
The menu bar, dock panels, modes, highlights and persona switches have grown
enough that finding an action by name beats hunting through menus — and a
palette makes hotkey collisions across Windows/Linux/Mac matter less, since
every action is reachable by name.

## What shipped (deviates from the original design notes below — see ADR 0100)
Rather than migrating every menu action into `commands.ts` first (the original plan), the palette **flattens the live menu bar** (`menus: MenuBarMenu[]`, already built for `<MenuBar>`) plus six keyboard-only actions that have a handler but no menu item. One new pure module, `src/renderer/src/paletteActions.ts` (`buildPaletteActions`, `filterPaletteActions`), and `src/renderer/src/components/CommandPalette.tsx` (arrow-key navigate, Enter/click to run, Escape/outside-click to close). Trigger: **Ctrl/Cmd+K** (`view.commandPalette` in `commands.ts`), plus a "Command palette…" View-menu entry. Shows up on the Help shortcuts page automatically.

## Tasks
- [x] Design pass — ADR 0100 (scope deviates from the notes below; see the ADR's Alternatives)
- [x] Palette overlay component (`CommandPalette.tsx`)
- [x] `paletteActions.ts` + unit tests
- [x] Listed in the Help shortcuts page (automatic — `view.commandPalette` is a normal `CommandDef`)
- [x] `typecheck` / `lint` / `npm test`
- [x] Live test in the Electron renderer (user)

## Design notes (original, before the ADR 0100 scope decision)
- Depends on 0120's command registry: each action needs an id, a human-readable title,
  a category, optional shortcut, and an *is-available-now* predicate (e.g. "Reload"
  is unavailable for a never-saved diagram) so the palette lists only what can run.
- Trigger: a hotkey (candidate Ctrl/Cmd+Shift+P or Ctrl/Cmd+K — check
  against the existing set and register it in the command registry); also a Help/View
  menu entry so it's discoverable.
- Fuzzy/substring match on title + category; recently used first is a nice-to-have.
- Actions that need arguments (pick a file, choose a colour) either open their
  normal dialog or are excluded in v1.
- Candidate for the future [feature toggle system](later/0124-feature-toggle-system.md), though cheap enough that it may not need one.

## Notes
No `.chd` schema change.
