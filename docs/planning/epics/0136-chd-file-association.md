# 0136: Associate `.chd` files with the app (double-click to open)

## Status
Not Started — logged 2026-10-15 from a user observation ("a glaring gap"). Needs a short design pass and an ADR before implementation.

## Goal
After installing, double-clicking a `.chd` file in the file manager opens it in this app — in a new window if the app is already running — and `.chd` files show a recognisable icon. Today a freshly installed app can only open diagrams via File → Open or drag-and-drop, so a non-technical user's first double-click on a diagram does nothing useful.

## Current state (verified 2026-10-15)
- `electron-builder.yml` has **no `fileAssociations`** (and no mac document types / Linux MIME config).
- The app has **no handling of a file passed at launch**: no `process.argv` parsing, no `requestSingleInstanceLock`/`second-instance`, no macOS `open-file`. Each launch starts a plain empty window.

## Tasks
- [ ] Design pass + ADR: single-instance behaviour, where the opened path goes (new window vs. reuse an empty one), what happens to crash-recovery scan / recent list
- [ ] `electron-builder.yml`: `fileAssociations` for `chd` (name, description, icon, role) — Windows (NSIS registers the ProgID per-user), macOS document type, Linux desktop entry + MIME type
- [ ] Startup: parse the file path(s) from `process.argv` (Windows/Linux) and open them instead of / in addition to the empty window
- [ ] Already-running app: `requestSingleInstanceLock` + `second-instance` → open the file in a new window of the running process (the app is multi-window, [ADR 0023](../../decisions/0023-multi-window-diagram-model.md)); focus an existing window if that file is already open
- [ ] macOS: `open-file` event (can fire before `ready` — queue it)
- [ ] Linux: ship a MIME type definition (`application/x-chd` or similar) with the deb/snap; note AppImage does not register associations by itself
- [ ] A file icon for `.chd` (placeholder until real branding, [epic 0027](later/0027-app-branding-and-licensing.md))
- [ ] Uninstall removes the association cleanly
- [ ] Docs: `docs/architecture/packaging.md` section on associations; known-issues entry if Windows/Linux defaults misbehave
- [ ] Live-test matrix: Windows (cold launch via double-click, running-app double-click, path with spaces/unicode), Linux (**unverifiable on the dev machine — flag for the user**), macOS (untested, no Mac)

## Decisions so far
- **Keep the `.chd` extension** (decided 2026-10-15). The MAME/RetroArch collision affects a small slice of users, who can still open our files via drag-and-drop or File → Open. Mitigation: a distinctive ProgID/MIME type, never claim default aggressively, and the end user decides which app is default. **The installer should let the user choose whether to associate `.chd`** (an opt-in checkbox/page on Windows, not silent) — design it that way in the NSIS config.

## Open questions / risks
- **Extension collision.** `.chd` is also the MAME/RetroArch "Compressed Hunks of Data" disk-image format. Registering ours could capture those files for users who have emulators (and theirs may capture ours). The format and extension are established, so changing it is a big call — at minimum choose a distinctive ProgID/MIME type, don't claim "default" aggressively, and decide deliberately whether the extension is acceptable before the public release ([epic 0070](later/0070-public-release-under-new-identity.md)).
- **Windows will not let an installer force the default app** (user-choice protection): the association registers us as a handler, but the first double-click may show an "open with" chooser. Expected, document it.
- **Shared with the CLI** ([epic 0133](0133-ai-onboarding.md) group D): both need installer scripting (NSIS include / Linux package hooks). Consider doing the installer-touching parts together.
- Interaction with the existing "reuse an empty window" behaviour for recent diagrams and with startup orphan recovery — both open windows at startup.

## Notes
- Cross-platform rule applies in full: this is exactly the kind of feature that differs per OS and can only be verified on the machines that have it.
