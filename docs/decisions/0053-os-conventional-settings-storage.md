# 0053: Settings move to a real per-OS file, replacing localStorage

## Status
Decided (2026-08-23)

## Context
[Epic 0054](../planning/epics/0054-os-conventional-settings-storage.md) revisits `settings.ts`'s original `localStorage`-based storage (ADR 0032) now that the app is actually distributed as an installable build (epic 0053) — a properly installed desktop app conventionally keeps its config in the OS's own per-user data location, not a browser storage API. Directly relevant prior art already existed: `settingsMirror.ts` (epic 0020/ADR 0040) already wrote one boolean (`scanForUnsavedRecoveryOnStartup`) to a JSON file under `app.getPath('userData')`, specifically because the main process needs it before any renderer/`localStorage` exists at startup.

## Decision

**1. Generalize `settingsMirror.ts`'s own mechanism to the whole settings object, rather than inventing something new.** One `settings.json` under `app.getPath('userData')` (`src/main/appSettings.ts`), holding the entire `AppSettings` object. `settingsMirror.ts` is retired entirely — main can now read the real settings file directly at startup instead of needing a separate narrow mirror for just one field.

**2. `AppSettings` (and `PaletteColor`/`LegendCorner`) move to `@shared/settings.ts`.** Previously renderer-only (`src/renderer/src/settings.ts`); main now needs the same shape to type its own read/write. `src/renderer/src/settings.ts` re-exports these from `@shared/settings` so nothing importing them from there needed to change, and keeps the `useSettings()` hook itself (now IPC-backed) as the renderer-side piece.

**3. Main owns read/write via IPC (`settings:read`/`settings:write`); the renderer's `useSettings()` hook calls these instead of touching `localStorage` directly.** Renderers can't touch the filesystem directly — this app had no precedent for arbitrary app-level (non-diagram) file access before this.

**4. Cross-window live sync via an explicit broadcast, not the `storage` event.** `localStorage`'s cross-window sync was free (the same key, same origin, fires `storage` in every other window automatically). The replacement: `settings:write`'s handler writes the file, then sends `settings:changed` to every *other* `BrowserWindow` (excluding the sender, which already updated its own state before the IPC call even returns — the write itself isn't awaited by the caller, keeping `updateSettings` feeling exactly as immediate as the old `localStorage.setItem` did).

**5. Migration happens in the renderer, once, on first read.** Main has no access to a renderer's `localStorage` at all — only a renderer can read it. `readAppSettings()` returns `null` when `settings.json` doesn't exist yet (fresh install *or* upgrading from a pre-0054 build); the renderer's mount effect then checks its own still-present `localStorage` value and, if found, adopts it and writes it to the new file via `writeAppSettings` — a one-time seed, not an ongoing dual-write. A genuinely fresh install (no file, no `localStorage`) just uses `DEFAULT_SETTINGS` in memory until the user changes something, rather than eagerly writing a file that only ever holds unmodified defaults. The old `localStorage` key is left in place afterward, unused — harmless orphaned data, not worth the complexity of actively clearing it.

**6. The startup orphan-scan gate (`main/index.ts`) treats a missing settings file as `scanForUnsavedRecoveryOnStartup: true`**, matching `settingsMirror.ts`'s own prior behavior on a cache miss — this one startup decision can't wait on the renderer's own migration (there's no renderer running yet at this exact point), and defaulting to "scan" is the same safe default the file it replaces already used.

## Alternatives considered

**Keeping `settingsMirror.ts` alongside the new general mechanism**, mirroring just the one field it always has — rejected as redundant now that main can read the real file directly for the same purpose.

**Having main reach into the renderer's `localStorage` directly** (e.g. via a session/webContents API) to migrate without any renderer-side code — rejected; Electron has no clean synchronous-at-startup path to another process's browser storage, and the renderer already has this data loaded for free.

## Consequences
- New files: `src/shared/settings.ts` (moved `AppSettings`/`DEFAULT_SETTINGS`/`PaletteColor`/`LegendCorner`), `src/main/appSettings.ts`. Removed: `src/main/settingsMirror.ts`.
- New IPC surface: `settings:read`, `settings:write`, `settings:changed` (main → renderer broadcast). Removed: `settings:mirrorScanOnStartup`.
- No `.chd` schema impact — this is entirely the app-wide Settings tier (see [ADR 0052](0052-settings-ownership-tiers.md)), never diagram content.
- Sets up epics [0072](../planning/epics/0072-gravity-presets-user-default.md)/[0073](../planning/epics/0073-max-connection-points-diagram-override.md)/[0074](../planning/epics/0074-multiple-named-style-palettes.md) to extend `AppSettings`'s shape on a stable foundation, rather than mid-migration.
