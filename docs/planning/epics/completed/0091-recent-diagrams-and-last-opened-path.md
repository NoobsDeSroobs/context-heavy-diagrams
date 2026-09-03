# 0091: Remember last opened path, recent diagrams under File

## Status
Item 1 done (2026-08-27), on `batch/2026-08-27-backlog-cleanup`, pending live test/merge. Item 2 split off into its own epic, [0095](0095-recent-diagrams-menu.md) — see that doc for why.

## What shipped (item 1)
`AppSettings.lastOpenedDirectory?: string` (`src/shared/settings.ts`), written directly by main — never through `SettingsPanel`, since this is a silent backend preference, not user-facing UI. Single source of truth for the write: `diagram:openPath` (`src/main/diagram.ts`), the one IPC handler every window-mount load path already funnels through (File → Open, linked-diagram navigation, drag-and-drop — confirmed via `windows.ts`'s own comment on `createWindow`'s `initialPath`), so this covers all of them without duplicating the update at every entry point. Also updated on a plain repeat Save (`diagram:save`), not just the first Save As — still real evidence of "actively working in this directory." Both File → Open (`windows:pickAndOpen`) and Save As (`diagram:pickSavePath`) now pass it as `defaultPath`, falling back to today's prior behavior (bare filename / OS default) when nothing's been opened/saved yet this install. New `updateAppSettings()` helper in `appSettings.ts` — a main-side partial-update-and-broadcast, for settings fields main itself needs to write outside of any renderer-initiated save. `typecheck`/`lint` clean (0 errors project-wide). No dedicated ADR — a small settings addition with one clear implementation choice (where to hook the single update), not a multi-alternative design decision.

## Goal
Two related file-opening conveniences, requested together:
1. **Remember the last opened path** — File → Open's dialog (`windows.ts`'s `windows:pickAndOpen` handler) currently calls `dialog.showOpenDialog` with no `defaultPath` at all, so it opens wherever the OS/Electron happens to default to, not wherever the user was last working.
2. **Recent diagrams under File** — a submenu (or flyout list) of recently opened diagrams, standard desktop-app convention, letting the user reopen one without a picker round-trip.

## What's actually involved (not equally small)
- **Item 1 is small**: persist the directory of the last opened/saved diagram (likely `AppSettings.lastOpenedDirectory` or similar — a per-user preference, not diagram content, per [ADR 0052](../../../decisions/0052-settings-ownership-tiers.md)'s ownership tiers) and pass it as `defaultPath` to every relevant `dialog.showOpenDialog`/`showSaveDialog` call (`windows.ts`, `diagram.ts`). A few call sites, no new UI.
- **Item 2 is bigger than it looks**: this app's custom top menu bar (`MenuBar.tsx`, epic 0049) has a flat `MenuBarItem[]` model today — **no nested submenu/flyout support exists at all**. "Recent diagrams" as a real submenu (the standard convention: File → Recent Diagrams → [list] → a separator → Clear Recent) needs that capability built first, not just a new top-level menu item. Also needs: a persisted, bounded list of recently opened paths (Settings-tier, capped at some count — 10? needs deciding), logic for what counts as "opened" (every File → Open? also drag-and-drop opens, epic 0038? also the startup "reopen last file" flow if one exists?), staleness handling (a recent path whose file has since been moved/deleted — skip it silently, or show it grayed out with a "not found" affordance?), and where entries get added/removed (most-recent-first, dedup on reopening something already in the list, eviction once past the cap).

## Open questions, not yet discussed with the user
Moved to [epic 0095](0095-recent-diagrams-menu.md) — all were about item 2, none applied to item 1.

## Notes
Requested 2026-08-25, logged without further design discussion. Item 2 in particular needs a real design pass on the submenu mechanism before implementation — not a drop-in alongside item 1. Confirmed true once item 1 actually shipped 2026-08-27 — item 2 split off into epic 0095 rather than block this epic (part of a "small fixes" cleanup batch) on unscoped submenu work.
