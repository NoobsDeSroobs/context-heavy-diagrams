# 0095: Recent diagrams under File

## Status
Done (2026-08-31), on `epic/0095-recent-diagrams-menu`, pending live test/merge. See [ADR 0078](../../decisions/0078-recent-diagrams-menu.md).

## What shipped
- **MenuBar submenu support** — `MenuBarItem` gains `submenu?: MenuBarItem[]` and `separatorBefore?: boolean`; one nesting level, right-side flyout. Flyout only ever *opens* on hover (never closes), so the diagonal path parent→flyout can cross sibling leaves without it vanishing. `openSubmenu` state scoped `{ menu, label }` so a top-level switch drops it with no reset effect.
- **`AppPreferences.recentDiagrams?: string[]`** — absolute paths, most-recent-first, deduped, clamped. Silent backend field (not in PreferencesPanel), same as `lastOpenedDirectory`. Written by `main/diagram.ts`'s `recordOpenedOrSaved` (folded into the existing `diagram:openPath` / `diagram:save` update) — so **following a linked diagram counts as "opened"** (user's call). `normalizePreferences` dedupes + clamps at every boundary.
- **`AppPreferences.recentDiagramsLimit: number`** (default 10) — a PreferencesPanel field ("Recent diagrams to remember", min 1). Lowering it trims immediately (menu slices to it) and permanently (normalize).
- **`windows:openRecent(path)`** IPC (modelled on `windows:openLinked`) — opens/focuses a window, or on a missing file prunes the entry and returns `{found:false}` → renderer shows a "not found" alert. Self-cleaning, no greyed-out entries, no per-menu-open fs scan.
- **File → Recent Diagrams ▸ [`…/parent/name.chd` ×N] · ─── · Clear Recent.** Empty list → the parent item is present but disabled. The current diagram's own entry is disabled.
- `typecheck`/`lint` clean (0 errors). Not live-tested (Electron renderer).

## Goal
A submenu (or flyout list) of recently opened diagrams under File, letting the user reopen one without a picker round-trip — standard desktop-app convention. Split out from [epic 0091](completed/0091-recent-diagrams-and-last-opened-path.md), whose item 1 (remember the last-opened directory for File → Open/Save As's dialogs) shipped on its own — this item needs real infrastructure and design work that item 1 didn't.

## What's actually involved
This app's custom top menu bar (`MenuBar.tsx`, epic 0049) has a flat `MenuBarItem[]` model today — **no nested submenu/flyout support exists at all**. "Recent diagrams" as a real submenu (the standard convention: File → Recent Diagrams → [list] → a separator → Clear Recent) needs that capability built first, not just a new top-level menu item.

## Open questions — resolved with the user 2026-08-31
- **Menu shape**: real submenu/flyout (not a flat section). Infra built into `MenuBar`.
- **What counts as "opened"**: everything that funnels through `diagram:openPath` — File → Open, drag-and-drop, **and following a linked diagram**. Simplest; matches `lastOpenedDirectory`.
- **Cap**: default 10, but exposed as a user preference (`recentDiagramsLimit`, PreferencesPanel) at the user's request.
- **Staleness**: prune-on-failed-open (main owns the list, removes the dead entry, renderer shows a "not found" alert). No greyed-out entries.
- **"Clear Recent"**: yes, in the submenu below a separator.

## Notes
Originally epic 0091 (raised 2026-08-25) — that epic's own doc flagged this item as "bigger than it looks" and needing "a real design pass on the submenu mechanism before implementation — not a drop-in alongside item 1" from the start. Split into its own epic 2026-08-27 once item 1 actually shipped, rather than let this bigger, unscoped half block closing out a "small fixes" batch it was originally bundled into.
