# 0054: Move app settings into a real per-OS config location

## Status
Not Started — not yet scoped. Raised by the user together with [epic 0053](0053-installable-distribution.md), explicitly not to be designed now.

## Goal
[Epic 0047](0047-edge-forced-straight-segment.md) just added this app's first global setting (`edgeStraightSegmentLength`), stored via `settings.ts` in the renderer's `localStorage` — a reasonable starting point (mirrors `theme.ts`'s existing pattern), but not where a properly *installed* desktop app conventionally keeps its config. The user wants this revisited once the app is actually distributed as an installable build (epic 0053): a real file in the OS's own per-user config location — on Windows, something under `%APPDATA%` (Roaming) or `%LOCALAPPDATA%` (Local); the equivalents on Linux/Mac (this app is cross-platform per the project brief) would need the same treatment. Electron's own `app.getPath('userData')` is the conventional API for this, resolving to the right OS-specific path automatically.

The user was explicit that today's `localStorage`-based approach is fine to leave as-is for now — this isn't urgent on its own, just something to fold into the same epic (or a closely sequenced one) as epic 0053, since "a real installed app with real OS-level settings" is one coherent step, not two unrelated ones.

## Relevant existing behavior
`src/renderer/src/settings.ts` (epic 0047/ADR 0032): one `AppSettings` object under a single `localStorage` key, with a `useSettings()` hook that syncs live across windows via the `storage` event. Whatever replaces this needs to preserve that same live-multi-window-sync behavior, not regress it — likely via an IPC round-trip to the main process (which alone can read/write `app.getPath('userData')`) plus a broadcast to other windows, rather than the renderer-local `storage` event this version leans on.

## Real open questions (deliberately not resolved here)
- **Exact file location and format** — `app.getPath('userData')` is the obvious API, but the precise path structure (a single JSON file? a subfolder?) isn't decided.
- **IPC design** — renderers can't touch the filesystem directly (this app has no such precedent yet for arbitrary app-level, non-diagram files); reading/writing settings would need a main-process IPC handler, unlike `localStorage` which every window can hit directly today. The live-sync-across-windows behavior `useSettings()` currently gets for free from the `storage` event would need an explicit broadcast mechanism instead (e.g. `BrowserWindow.getAllWindows().forEach(w => w.webContents.send(...))` on change).
- **Migration** — does an existing `localStorage`-based settings value get carried over automatically the first time a user upgrades into a build with this change, or does it just reset to defaults? Silent data loss on upgrade would be a bad first impression for exactly the non-technical audience epic 0053 is for.
- **Scope relative to epic 0053** — same epic, or sequenced right after it? The user's framing ("during the same epic or epics") leaves this open.

## Notes
Not scheduled into the current batch (see [PROGRESS.md](../../../PROGRESS.md)) — flagged here so it isn't lost, not because it's next up.
