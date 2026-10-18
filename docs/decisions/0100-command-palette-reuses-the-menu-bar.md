# 0100: The command palette reads the live menu bar instead of a second registry

## Status
Accepted (2026-09-29); implemented and live-tested.

## Context
A keyboard-invoked, searchable launcher for app actions was planned to be driven by the command registry (`commands.ts`, [ADR 0094](0094-command-registry-and-shortcuts-help.md)), the way the Help → shortcuts page already is. Looking at it closer: `commands.ts` only ever grew to cover *keyboard shortcuts and mouse gestures* — that was its whole brief. Most of what a user would actually want to reach by typing a name ("diagnostics", "export png", "preferences") is a **menu item with no `CommandDef` at all**: it lives only in the hand-built `fileMenu`/`editMenu`/`viewMenu`/`helpMenu` objects in `Canvas.tsx`, each item already carrying exactly the fields a palette needs (`label`, `accelerator`, `disabled`, `onSelect`).

## Decision
**The palette is built by flattening two things that already exist, not a new registry:**
- **Every menu bar leaf item** (`menus: MenuBarMenu[]`, already computed for `<MenuBar>`) becomes one row: `label` → title, the containing menu's `label` → category, `accelerator` → shortcut, `onSelect` → the action. A `disabled` item, or a submenu parent (only "Recent Diagrams" today), is **left out of the list entirely** rather than shown greyed out — "the palette lists only what can run" for free, with no separate availability predicate to keep in sync.
- **A handful of keyboard-only actions with no menu item** (`edit.duplicate`, `style.copy`, `style.paste`, `selection.selectAll`, `view.fit`, `search.toggle` — everything in `commands.ts` with a real handler in `Canvas.tsx`'s keydown `handlers` map but no menu entry) are appended by hand, reusing those same handler functions.
- Pure logic in `src/renderer/src/paletteActions.ts` (`buildPaletteActions`, `filterPaletteActions` — substring match on title+category, same style as `ShortcutsDialog`'s own filter), unit-tested; `CommandPalette.tsx` is the overlay component (arrow-key navigate, Enter to run, click to run, Escape/outside-click to close — same close-then-run ordering `MenuBar`'s own `DropdownItem` already uses).
- **Trigger: Ctrl/Cmd+K**, one new `CommandDef` (`view.commandPalette`, category `View`) — free of the existing bindings (checked against `commands.test.mjs`'s own overlap test) and the now-standard convention (Slack/Linear/Notion/Raycast) over VS Code's three-key Ctrl+Shift+P. Also a View-menu item ("Command palette…") for discoverability, and it shows up on the Help shortcuts page automatically (it's a normal `CommandDef`).

## Alternatives considered
- **Migrate every menu action into `commands.ts` first**, so both the menu bar and the palette read the same registry. Rejected for v1: it means touching every menu item's construction in `Canvas.tsx` (moving each `disabled`/`onSelect` out of its hand-written menu object into a registry entry plus a lookup), a much bigger and riskier diff, for a maintenance benefit (one source of truth instead of two) that flattening-at-read-time already delivers in practice — the palette can never show something the menu bar disagrees with, because it reads the exact same `menus` value. Revisit if the two ever drift apart in a way flattening can't paper over.
- **Fuzzy scoring / recently-used ordering** — both nice-to-haves, not requirements; substring match in stable menu order is enough for the number of actions this app has today.

## Consequences
- "Recent Diagrams" entries aren't palette-searchable (only its parent "Recent Diagrams" *label*, and only if it had a runnable `onSelect`, which it doesn't). Acceptable — those are per-file, not named actions.
- "Delete selection" isn't included (it's React Flow's native Delete/Backspace handling, not a callable `handlers` entry) — a natural small follow-up if wanted, not built here to keep v1 to "reuse existing handlers only."
- No `.chd` schema change.
