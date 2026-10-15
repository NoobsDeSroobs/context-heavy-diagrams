# 0136: Associate `.chd` files with the app (double-click to open)

## Status
In progress — logged 2026-10-15 from a user observation ("a glaring gap"). Design settled in [ADR 0108](../../decisions/0108-chd-file-association-and-single-instance.md). Implemented on `epic/0136-chd-file-association` 2026-10-15; `typecheck`/`lint`/`npm test` clean (134), the Windows installer builds, and the single-instance + launch-argument behavior was verified on an unpacked build. **Live-tested on Windows and confirmed working by the user (2026-10-15)**, including the installer. **Still unverified:** Linux and macOS (deb/snap MIME type and desktop entry, `open-file`, document type); pending PR/merge, then move to `completed/`.

## Goal
After installing, double-clicking a `.chd` file in the file manager opens it in this app — in a new window if the app is already running — and `.chd` files show a recognisable icon. Today a freshly installed app can only open diagrams via File → Open or drag-and-drop, so a non-technical user's first double-click on a diagram does nothing useful.

## Current state (verified 2026-10-15)
- `electron-builder.yml` has **no `fileAssociations`** (and no mac document types / Linux MIME config).
- The app has **no handling of a file passed at launch**: no `process.argv` parsing, no `requestSingleInstanceLock`/`second-instance`, no macOS `open-file`. Each launch starts a plain empty window.

## Tasks
- [x] Design pass + ADR ([ADR 0108](../../decisions/0108-chd-file-association-and-single-instance.md)): single instance, files open in their own windows (no empty-window reuse), orphan scan parented to the first opened window, opt-in association at install
- [x] Windows installer: switch to the assisted (wizard) form, still per-user, with an "Associate `.chd` files" checkbox (default on); registry keys written by our own NSIS script, guarded by it
- [x] Installer options page also asks "Enable AI features?" (default on) and writes `install-options.json` next to the exe; main seeds `settings.json` from it on first run only, if no settings file exists yet; removed on uninstall (unit-test the seeding/merge logic)
- [x] `electron-builder.yml`: `fileAssociations` for `chd` (name, description, icon, role, explicit vendor MIME type) for macOS and Linux; confirm how to keep it from registering unconditionally on Windows
- [x] Pure, unit-tested helper that extracts `.chd` paths from an argument list (resolved against a working directory)
- [x] Startup: open the paths from `process.argv` (Windows/Linux) instead of the blank window; no files = unchanged behavior
- [x] Already-running app: `requestSingleInstanceLock` (skipped when not packaged) + `second-instance` → open each file in the running process via `openOrFocusWindow`; with no files, focus the last-used window
- [x] macOS: `open-file` event (can fire before `ready` — queue it) — **written, unverified**
- [x] Linux: ship a MIME type definition (`application/x-chd` or similar) with the deb/snap; note AppImage does not register associations by itself — **written, unverified**
- [x] File icon for `.chd`: reuse the app icon for now (dedicated one waits for [epic 0027](later/0027-app-branding-and-licensing.md))
- [x] Uninstall removes the association cleanly — verified on Windows
- [x] Docs: `docs/architecture/packaging.md` section on associations; known-issues entry if Windows/Linux defaults misbehave
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
