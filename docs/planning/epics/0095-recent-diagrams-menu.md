# 0095: Recent diagrams under File

## Status
Not Started — split off epic 0091 on 2026-08-27, not yet scoped further.

## Goal
A submenu (or flyout list) of recently opened diagrams under File, letting the user reopen one without a picker round-trip — standard desktop-app convention. Split out from [epic 0091](0091-recent-diagrams-and-last-opened-path.md), whose item 1 (remember the last-opened directory for File → Open/Save As's dialogs) shipped on its own — this item needs real infrastructure and design work that item 1 didn't.

## What's actually involved
This app's custom top menu bar (`MenuBar.tsx`, epic 0049) has a flat `MenuBarItem[]` model today — **no nested submenu/flyout support exists at all**. "Recent diagrams" as a real submenu (the standard convention: File → Recent Diagrams → [list] → a separator → Clear Recent) needs that capability built first, not just a new top-level menu item.

Also needs:
- A persisted, bounded list of recently opened paths (Settings-tier, per [ADR 0052](../../decisions/0052-settings-ownership-tiers.md) — a per-user preference, not diagram content, same tier `lastOpenedDirectory` landed on).
- A capped count — 10? Needs deciding.
- Logic for what counts as "opened": every File → Open, drag-and-drop (epic 0038)? Does opening a *linked* diagram (Ctrl/Cmd-click navigation, epic 0009) count too, or only an explicit open? (`diagram:openPath` — the single IPC handler epic 0091's `lastOpenedDirectory` update hooked into, since every open path funnels through it — sees all of these indiscriminately; recent-list membership may want to be pickier than directory-tracking was.)
- Staleness handling: a recent path whose file has since been moved/deleted — skip it silently, or show it grayed out with a "not found" affordance?
- Where entries get added/removed: most-recent-first, dedup on reopening something already in the list, eviction once past the cap.
- Does "Clear Recent" belong in the submenu itself, or is that overkill for a v1?

## Notes
Originally epic 0091 (raised 2026-08-25) — that epic's own doc flagged this item as "bigger than it looks" and needing "a real design pass on the submenu mechanism before implementation — not a drop-in alongside item 1" from the start. Split into its own epic 2026-08-27 once item 1 actually shipped, rather than let this bigger, unscoped half block closing out a "small fixes" batch it was originally bundled into.
