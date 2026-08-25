# 0091: Remember last opened path, recent diagrams under File

## Status
Not Started

## Goal
Two related file-opening conveniences, requested together:
1. **Remember the last opened path** — File → Open's dialog (`windows.ts`'s `windows:pickAndOpen` handler) currently calls `dialog.showOpenDialog` with no `defaultPath` at all, so it opens wherever the OS/Electron happens to default to, not wherever the user was last working.
2. **Recent diagrams under File** — a submenu (or flyout list) of recently opened diagrams, standard desktop-app convention, letting the user reopen one without a picker round-trip.

## What's actually involved (not equally small)
- **Item 1 is small**: persist the directory of the last opened/saved diagram (likely `AppSettings.lastOpenedDirectory` or similar — a per-user preference, not diagram content, per [ADR 0052](../../decisions/0052-settings-ownership-tiers.md)'s ownership tiers) and pass it as `defaultPath` to every relevant `dialog.showOpenDialog`/`showSaveDialog` call (`windows.ts`, `diagram.ts`). A few call sites, no new UI.
- **Item 2 is bigger than it looks**: this app's custom top menu bar (`MenuBar.tsx`, epic 0049) has a flat `MenuBarItem[]` model today — **no nested submenu/flyout support exists at all**. "Recent diagrams" as a real submenu (the standard convention: File → Recent Diagrams → [list] → a separator → Clear Recent) needs that capability built first, not just a new top-level menu item. Also needs: a persisted, bounded list of recently opened paths (Settings-tier, capped at some count — 10? needs deciding), logic for what counts as "opened" (every File → Open? also drag-and-drop opens, epic 0038? also the startup "reopen last file" flow if one exists?), staleness handling (a recent path whose file has since been moved/deleted — skip it silently, or show it grayed out with a "not found" affordance?), and where entries get added/removed (most-recent-first, dedup on reopening something already in the list, eviction once past the cap).

## Open questions, not yet discussed with the user
- Recent-list cap and ordering (most-recently-opened-first is the obvious default, but worth confirming)
- Does "Clear Recent" belong in the submenu itself, or is that overkill for a v1?
- Does opening a *linked* diagram (Ctrl/Cmd-click navigation, epic 0009) count as "opening" for recent-list purposes, or only an explicit File → Open/drag-and-drop?
- Missing-file handling in the list (see above)

## Notes
Requested 2026-08-25, logged without further design discussion. Item 2 in particular needs a real design pass on the submenu mechanism before implementation — not a drop-in alongside item 1.
