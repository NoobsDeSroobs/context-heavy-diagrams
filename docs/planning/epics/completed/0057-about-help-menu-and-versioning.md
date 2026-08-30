# 0057: About/Help menu and app versioning scheme

## Status
Done (2026-08-22)

## Goal
Two coupled pieces:
1. A real versioning scheme for the *app itself* (not to be confused with the `.chd` file format's own `version` field, currently always `1` — see `docs/file-format.md`. Two entirely separate concepts that happen to share a name; keep them distinct when this gets scoped).
2. A Help/About menu entry (the current top menu bar, epic 0049/ADR 0039, is File/Edit/View only — no Help or About exists anywhere in the app today) showing the version and whatever else an About screen conventionally carries.

## Decisions made
- **Versioning scheme**: semver in `package.json`'s existing `version` field, reset from the inherited placeholder `1.0.0` down to `0.1.0` (pre-1.0, "initial development" per semver convention — accurate, since the app has never been publicly distributed). Bumped manually per user-facing PR merge to `master`; `1.0.0` reserved for epic 0053 (installable distribution) actually landing, not for feature completeness. Full reasoning in [ADR 0044](../../../decisions/0044-app-versioning-scheme.md).
- **About screen shape**: a centered modal overlay (`AboutDialog.tsx`), not one of the fixed right-dock panels (ADR 0013) — an About screen is a one-off glance-and-dismiss popup, not an ongoing inspection tool. Shows: version (read live via `app.getVersion()` over a new `app:getVersion` IPC call, not duplicated as a separate constant), license (GPL-3.0-or-later), a short description, and credits for the main runtime dependencies (Electron, React, React Flow, Tabler Icons, react-markdown) plus a link to the repo. No logo — still blocked on epic 0027 (branding).
- **Help menu scope**: just "About" for v1 — no keyboard-shortcuts reference or docs link added, to avoid scope creep on a small epic; either can be added to the same menu later without any redesign.

## Tasks
- [x] `package.json` version → `0.1.0`, ADR 0044 written.
- [x] `app:getVersion` IPC handler (`src/main/appInfo.ts`), registered in `src/main/index.ts`.
- [x] `getAppVersion()` on the preload `api` (`src/preload/index.ts` + `index.d.ts`).
- [x] `AboutDialog.tsx` — centered overlay, click-outside/Escape-to-close (same pattern as `MenuBar.tsx`/`ContextMenu.tsx`), styled in `main.css`.
- [x] "Help" menu added to `Canvas.tsx`'s `MenuBar` menus, single "About" item.
- [x] `npm run typecheck` clean; `npm run lint` shows zero new errors (only the 4 pre-existing ones tracked by epic 0028, untouched by this change).

## Notes
The repo's actual remote is `https://github.com/NoobsDeSroobs/context-heavy-diagram-tool` — used as the About dialog's repo link. Worth flagging: some earlier `PROGRESS.md` entries link PRs under `github.com/anthropics/...`, which doesn't match the real remote — a pre-existing inaccuracy in those historical log entries, not something this epic touches or fixes.

External links (the repo URL) open via the existing `shell.openExternal` `setWindowOpenHandler` in `src/main/windows.ts` — already wired for any `target="_blank"` link app-wide, no new handling needed.

Not independently verified in the running app (Electron's `window.api` only exists inside a real `BrowserWindow`, not the Browser pane — same limitation noted in epic 0022's Notes) — worth a quick look by the user: Help → About opens, shows `0.1.0`, closes on Escape/click-outside/✕, and the repo link opens in the default browser.
