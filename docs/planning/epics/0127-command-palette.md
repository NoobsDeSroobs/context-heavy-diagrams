# 0127: Command palette

## Status
Not Started — logged 2026-09-19. User agreed to build it because its main
cost (the command registry) is already required by
[epic 0120](completed/0120-help-keyboard-shortcuts-page.md). **Sequenced after 0120.**

## Goal
A keyboard-invoked, searchable launcher for app actions (type "export png",
"toggle dark mode", "open diagnostics" → Enter). It is a different thing from
the Help → shortcuts page (a static reference), but both read the same command registry.

## Why it earns its place
The menu bar, dock panels, modes, highlights and persona switches have grown
enough that finding an action by name beats hunting through menus — and a
palette makes hotkey collisions across Windows/Linux/Mac matter less, since
every action is reachable by name.

## Design notes
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

## Tasks
- [ ] Design pass: trigger key, action availability predicates, which actions are palette-able in v1
- [ ] Palette overlay component (same family as `SearchOverlay`)
- [ ] Migrate menu/keyboard actions to be command-registry-driven (shared with 0120)
- [ ] Listed in the Help shortcuts page
