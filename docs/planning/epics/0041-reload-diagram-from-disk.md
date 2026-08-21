# 0041: Reload diagram from disk

## Status
Done

## Goal
A "Reload" action for a window's own currently-open diagram — re-read the file from disk and load it into the canvas in place, without closing the window or relaunching the app. Raised by the user (2026-08-20) during epic 0022's gallery work: `.chd` files were being hand-edited outside the app (by Claude, directly against `docs/file-format.md`), and picking up those changes required fully quitting and relaunching the app, since there was no in-app way to re-read a file that had changed on disk underneath an already-open window.

## Tasks
- [x] `handleReload` in `Canvas.tsx` — reuses `loadDiagramIntoCanvas` (the same function the initial `?path=` mount load uses), so this gets the exact same state reset (undo history cleared, highlights re-disabled, panels closed, required-tags reconciliation re-run) as opening the file fresh, not a partial/ad hoc refresh.
- [x] Confirmation dialog before reloading (`confirm()`, same pattern as the existing "copy required tags to children" confirmation) — this app has no dirty-tracking yet (epic 0020, not started), so there's no way to know whether there are actually unsaved changes to lose; always confirms rather than guessing.
- [x] Toolbar button ("Reload"), disabled when the window has no `currentPath` (a new, never-saved diagram has nothing on disk to reload from).
- [x] `npm run typecheck`/`lint` clean (no new errors beyond the 4 pre-existing ones tracked by epic 0028).

## Notes
No keyboard shortcut added. Ctrl/Cmd+R was the obvious candidate (matches "reload" convention elsewhere) but was deliberately skipped — Electron/Chromium may already intercept that combination for its own page-reload behavior depending on configuration, and colliding with that seemed like a worse outcome than just not having a shortcut yet. A shortcut can be added later once that's actually checked, rather than guessed at here.

Not independently verified in the running app — this was built and typechecked/linted but not clicked through; per the established pattern in this project (epic 0013's own notes, epic 0022's testing loop), that verification is the user's to do rather than something worth fighting browser automation for on a native Electron app.
