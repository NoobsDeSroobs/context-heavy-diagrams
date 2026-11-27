# 0053: Preferences live in a per-OS file owned by the main process, not in localStorage

## Status
Decided (2026-08-23). Trimmed 2026-11-26 to the decision.

## Context
Preferences began in the renderer's `localStorage`. A properly installed desktop app keeps its configuration in the OS's per-user data location, and the main process needs some settings before any window exists (whether to scan for unsaved work at startup), which `localStorage` cannot give it.

## Decision
- **One `settings.json` under `app.getPath('userData')` holds the whole `AppPreferences` object.** The main process owns it (`src/main/preferences/appPreferences.ts`; the type is in `src/shared/preferences/`) and reads it at startup, so no separate mirror of single settings is needed.
- **Renderers reach it only through IPC** (`preferences:read`, `preferences:write`); they cannot touch the file. A write is broadcast to every other window (`preferences:changed`), which replaces the cross-window sync `localStorage` gave for free.
- **Migration happens once, in the renderer,** which is the only place that can read the old `localStorage`: with no file yet, it adopts its old value and writes it. A fresh install writes nothing until a setting changes.
- Preferences are the app-wide tier ([0052](0052-settings-ownership-tiers.md)): never diagram content, and no `.chd` schema impact.

## Alternatives considered
- **Keep a mirror file for the one setting main needs, beside `localStorage`.** Redundant once main can read the real file.
- **Have main reach into a renderer's `localStorage`.** Electron has no clean synchronous path to it at startup, and the renderer already has the data.
