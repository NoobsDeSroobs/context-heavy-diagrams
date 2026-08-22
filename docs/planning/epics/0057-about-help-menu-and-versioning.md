# 0057: About/Help menu and app versioning scheme

## Status
Not Started — not yet scoped. Raised by the user (2026-08-22). Deliberately not designed here, just captured so it isn't lost, same as epics 0024/0026/0030/0037/0038/0048/0055/0056 before their own design passes. **Explicitly told to log this and ignore it for now.**

## Goal
Two coupled pieces:
1. A real versioning scheme for the *app itself* (not to be confused with the `.chd` file format's own `version` field, currently always `1` — see `docs/file-format.md`. Two entirely separate concepts that happen to share a name; keep them distinct when this gets scoped).
2. A Help/About menu entry (the current top menu bar, epic 0049/ADR 0039, is File/Edit/View only — no Help or About exists anywhere in the app today) showing the version and whatever else an About screen conventionally carries.

## Relevant existing behavior
- `package.json`'s `"version": "1.0.0"` already exists — inherited from the original electron-scaffold template, never deliberately set or bumped since. Nothing reads it or displays it anywhere in the app today.
- Menu bar is a custom in-renderer component (`MenuBar.tsx`, generic `{ menus: MenuBarMenu[] }`), not a native Electron menu — adding a Help menu is straightforward from a mechanics standpoint, same pattern as File/Edit/View.
- No branding assets exist yet — an About screen showing a logo/icon would be blocked on [epic 0027](0027-app-branding-and-licensing.md) for that specific piece, though version/license/credits text doesn't need to wait on it.

## Real open questions (deliberately not resolved here)
- What versioning scheme — semver tied to git tags/releases? Something simpler? Does it bump per epic, per merge to `master`, or only at actual distribution points (ties into [epic 0053](0053-installable-distribution.md))?
- What does "About" actually show — version number, license (GPL-3.0-or-later, already decided per [ADR 0011](../../decisions/0011-software-license-choice.md)), credits/attribution (Tabler Icons, React Flow, Electron, etc.), a link to the repo?
- Does "Help" mean anything beyond "About" — a link to docs, keyboard shortcuts reference, or is it just the one entry?

## Notes
Also raised in the same message, not part of this epic's own scope: a **post-v1 brainstorming pass** — once the app is considered fully "v1 done," revisit the whole backlog and ideas list fresh rather than just continuing to work through what's already logged. Not an epic with content of its own yet (nothing's been brainstormed) — just a milestone marker. See [PROGRESS.md](../../../PROGRESS.md) for where that's tracked.

Not scheduled into any current batch — flagged here so it isn't lost, not because it's next up.
