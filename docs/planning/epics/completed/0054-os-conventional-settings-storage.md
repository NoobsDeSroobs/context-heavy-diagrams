# 0054: Move app settings into a real per-OS config location

## Status
Done (2026-08-23), on `epic/0054-os-conventional-settings-storage`, pending live test/PR/merge. Implementation per [ADR 0053](../../../decisions/0053-os-conventional-settings-storage.md); ownership terminology this epic's own design conversation surfaced settled separately in [ADR 0052](../../../decisions/0052-settings-ownership-tiers.md)/[the glossary](../../../architecture/glossary.md).

## Goal
[Epic 0047](0047-edge-forced-straight-segment.md) just added this app's first global setting (`edgeStraightSegmentLength`), stored via `settings.ts` in the renderer's `localStorage` — a reasonable starting point (mirrors `theme.ts`'s existing pattern), but not where a properly *installed* desktop app conventionally keeps its config. The user wants this revisited once the app is actually distributed as an installable build (epic 0053): a real file in the OS's own per-user config location — on Windows, something under `%APPDATA%` (Roaming) or `%LOCALAPPDATA%` (Local); the equivalents on Linux/Mac (this app is cross-platform per the project brief) would need the same treatment. Electron's own `app.getPath('userData')` is the conventional API for this, resolving to the right OS-specific path automatically.

## Tasks
- [x] `settings.json` under `app.getPath('userData')`, main-owned read/write via IPC (`src/main/appSettings.ts`)
- [x] `AppSettings`/`DEFAULT_SETTINGS`/`PaletteColor`/`LegendCorner` moved to `@shared/settings.ts` (main and renderer both need the shape now)
- [x] Cross-window live sync via an explicit `settings:changed` broadcast, replacing the `storage` event
- [x] One-time migration from the renderer's old `localStorage` value when `settings.json` doesn't exist yet
- [x] `settingsMirror.ts` retired — main reads the real settings file directly at startup instead

## Notes
**2026-08-23: mid-implementation, a broader terminology question got raised and resolved first.** The user paused this epic to settle what "settings" even means across three different scopes this app has (per-element, per-diagram, per-app) plus three specific values (style palette, gravity presets, max connection points) that didn't obviously belong to just one — see [ADR 0052](../../../decisions/0052-settings-ownership-tiers.md) and [docs/architecture/glossary.md](../../../architecture/glossary.md). That produced three new, separately-scoped epics ([0072](0072-gravity-presets-user-default.md), [0073](0073-max-connection-points-diagram-override.md), [0074](0074-multiple-named-style-palettes.md)), deliberately sequenced *after* this one — this epic's own `AppSettings` shape is unchanged by that conversation, only the storage mechanism moved.

Not yet live-tested (needs a real Electron window — see [feedback-delegate-visual-testing](../../../known-issues.md) convention): confirm settings persist across app restarts, sync live across multiple open windows, and that an existing pre-upgrade `localStorage` value survives the migration.
