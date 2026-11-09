# 0186: `chd` on the PATH, as a choice in the installer

## Status
In Progress: built and tested on a scratch registry key; the installer itself has not been run (see the tasks). When it is done and merged, the next release is tagged (see the last task).

## Goal
Someone who installs the app on Windows can tick a box on the installer's options page and then type `chd` in any new terminal. Unticked, the installer changes nothing about the PATH.

## Why
`chd` ships as `chd.cmd` next to the app, but nothing puts it on the PATH, so PowerShell cannot find it ([ADR 0106](../../decisions/0106-chd-command-line-tool.md) deferred this: "revisit together with file associations", which the installer now has). People who use the command line, `chd edit` and `chd ask` for assistants among them, have to type a long path.

## Design notes
- **Per-user only:** edit `HKCU\Environment\Path`, as the file association and uninstaller already work per user, without elevation.
- **A `bin` folder with only a shim,** so the PATH gets `chd` and not the app's whole folder. `bin\chd.cmd` is one line that calls the launcher one folder up. The launcher itself is not moved: the path written into existing `AGENTS.md` files and the one `src/main/ai/ai.ts` computes stay valid.
- **Default unticked:** the other two boxes change what the app does; this one edits a user-wide variable.
- **Do not corrupt the PATH.** The value is `REG_EXPAND_SZ` and must stay one (a plain write turns `%USERPROFILE%` entries into fixed text). NSIS strings cap at 8192 characters and a longer value reads back as empty, which looks like no PATH at all: the first version of the code overwrote such a PATH, a test caught it, and an existing but unreadable PATH is now left alone. There is no EnVar plugin in electron-builder's NSIS, so the code is written by hand in `build/chdPath.nsh`.
- **Uninstall removes exactly its own entry** and nothing else, as the association does, and is skipped on an update like the rest.
- **Tell Windows,** by broadcasting `WM_SETTINGCHANGE` ("Environment"). Terminals already open still need to be reopened; say so on the page.
- **The install folder choice** ([0161](0161-published-windows-installers-built-by-ci.md), last task) moves the PATH entry with it, so build them knowing about each other.
- **Linux is separate:** a deb can link `chd` into `/usr/bin`; an AppImage cannot. Not part of this.
- `AGENTS.md` keeps the launcher's absolute path, since the PATH is optional.

## Tasks
- [x] ADR: PATH registration as an installer choice ([ADR 0162](../../decisions/0162-the-installer-can-put-chd-on-the-path.md), replaces the "No PATH registration for now" part of ADR 0106)
- [x] `build/chdPath.nsh` (add, remove, the unreadable-PATH guard) and `scripts/installerPath.test.mjs`, which runs it against a scratch registry key
- [x] `build/installer.nsh`: the checkbox and its explanation on the options page, the add on install, the exact removal on uninstall. Silent installs leave the PATH alone
- [x] `bin\chd.cmd` shim (`electron-builder.yml`, `build/launchers/chd-path.cmd`)
- [x] `docs/architecture/packaging.md`, `docs/cli-reference.md`, CHANGELOG
- [ ] Run the installer: wizard install ticked and unticked, `chd --version` in a new PowerShell and in `cmd`, the options page layout (three checkboxes in 140 dialog units), uninstall, an update over an install. Nobody has run it yet
- [ ] Release: with this merged, bump nothing new (`package.json` already says the next version), give the 0.8.0 changelog heading its date, and the maintainer tags `v0.8.0` on master ([CLAUDE.md](../../../CLAUDE.md), Releases); then `package.json` and the changelog move on to the next version
