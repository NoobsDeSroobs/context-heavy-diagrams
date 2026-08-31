# 0078: Recent Diagrams submenu + MenuBar submenu support

## Status

Accepted (2026-08-31). Implements [epic 0095](../planning/epics/0095-recent-diagrams-menu.md),
the half of [epic 0091](../planning/epics/completed/0091-recent-diagrams-and-last-opened-path.md)
that was split out because it needed real infrastructure. Builds on
[ADR 0039](0039-top-menu-bar.md) (custom in-renderer menu bar) and
[ADR 0052](0052-settings-ownership-tiers.md) (preference tiers).

## Context

"File → Recent Diagrams" is a standard desktop convention and was requested
alongside the last-opened-directory memory (which shipped separately). It was
blocked on two things the app didn't have: a menu bar that can nest, and a
persisted recent-paths list.

## Decision

### MenuBar gains one level of nesting

`MenuBarItem` gets `submenu?: MenuBarItem[]` and `separatorBefore?: boolean`
(the latter already existed on `ContextMenu`'s item type). An item with a
`submenu` renders a `▸` and a right-side flyout; it ignores `onSelect`. One
level only — the type is technically recursive but the renderer handles a
single nesting, which is all any planned menu needs (epic 0080's mode-aware
bar included).

Flyout interaction rule, to dodge the classic menu-corner problem: **hovering
only ever opens a flyout, never closes one.** Moving the pointer diagonally
from a parent toward its flyout can pass over sibling leaves without the
flyout vanishing. A flyout closes on: another submenu parent hovered, a leaf
clicked, a top-level menu switch, or click-outside / Escape. `openSubmenu`
state is scoped `{ menu, label }` so switching top-level menus drops it with
no reset effect (which the `react-hooks/set-state-in-effect` lint rule
forbids anyway).

### Recent list = a preference, written by main

- `AppPreferences.recentDiagrams?: string[]` — absolute paths, most-recent-
  first, deduped, clamped. **Not** user-editable in `PreferencesPanel` (same
  as `lastOpenedDirectory` — a silent backend field). Only its limit and the
  "Clear Recent" action are user-facing.
- `AppPreferences.recentDiagramsLimit: number` (default 10) — **is** a
  `PreferencesPanel` field, per the user's ask. Lowering it trims the stored
  list at the next `normalizePreferences` pass (and the menu slices to it
  immediately so the change is visible without a reload). Dropped entries
  don't return if raised again — expected for a recents list.
- Updated in `main/diagram.ts`'s `diagram:openPath` and `diagram:save`, in
  the same single write+broadcast that already maintained
  `lastOpenedDirectory` (`recordOpenedOrSaved`). `diagram:openPath` is the
  one funnel every load path hits, so **following a linked diagram counts as
  "opened"** — the user's explicit call: simplest, and a diagram you landed
  in is a diagram you opened. Revisit if it proves noisy.
- `normalizePreferences` dedupes and clamps `recentDiagrams` at every
  boundary that receives a prefs blob, same defensive stance as the
  style-palette migration.

### Opening / staleness

New `windows:openRecent(path)` IPC, modelled on `windows:openLinked`:
`access()` the path → open/focus a window for it, or on a missing file
**prune the entry from the list** (main owns the list) and return
`{ found: false }` so the renderer shows a brief "not found" notice. No
greyed-out entries, no per-menu-open filesystem scan — the list is
self-cleaning on use.

"Clear Recent" lives in the submenu below a separator; sets `recentDiagrams`
to `[]` via the renderer's own `updatePreferences`.

## Alternatives considered

- **Flat section at the bottom of the File menu** (no submenu infra). Half
  the code, but the File menu would run to ~20 items and it isn't the
  convention. Rejected by the user in favour of a real submenu — the infra
  is reusable for epic 0080.
- **Explicit opens only** (exclude linked-diagram navigation). Would need a
  flag threaded through `diagram:openPath` to distinguish nav from a
  deliberate open. Rejected by the user as not worth it.
- **Greyed-out "not found" entries** with a per-menu-open validity check.
  More UI, async fs work on every menu open. Prune-on-use is simpler and
  keeps the list honest.

## Consequences

- No `.chd` change — this is all preferences.
- `preload/index.d.ts` + `preload/index.ts` gain `openRecentDiagram`.
- Pre-existing race, not introduced here: a renderer with a debounced
  preferences write pending can clobber a main-side `recentDiagrams` update
  that lands in the 300 ms window. Same race `lastOpenedDirectory` has always
  had; not worth a rework for a recents list.
- New CSS: `.menu-bar-submenu`, `.menu-bar-submenu-anchor`,
  `.menu-bar-submenu-caret`, `.menu-bar-separator`.
