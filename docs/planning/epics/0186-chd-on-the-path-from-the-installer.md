# 0186: `chd` on the PATH, as a choice in the installer

## Status
Planned. Starts after the 0167 pull request is merged. When it is done and merged, the next release is tagged (see the last task).

## Goal
Someone who installs the app on Windows can tick a box on the installer's options page and then type `chd` in any new terminal. Unticked, the installer changes nothing about the PATH.

## Why
`chd` ships as `chd.cmd` next to the app, but nothing puts it on the PATH, so PowerShell cannot find it ([ADR 0106](../../decisions/0106-chd-command-line-tool.md) deferred this: "revisit together with file associations", which the installer now has). People who use the command line, `chd edit` and `chd ask` for assistants among them, have to type a long path.

## Design notes
- **Per-user only:** edit `HKCU\Environment\Path`, as the file association and uninstaller already work per user, without elevation.
- **A `bin` folder with only the launcher,** as VS Code does, so the PATH gets `chd` and not the app's whole folder. `chd.cmd` finds the exe with `%~dp0`, so it needs `..` and the extra-files target changes. Recommended over putting the install folder itself on the PATH.
- **Default unticked?** The other two boxes change what the app does; this one edits a user-wide variable. Unticked is the safer default; ticked matches the others. Decide when building.
- **Do not corrupt the PATH.** The value is `REG_EXPAND_SZ` and must stay one (a plain write turns `%USERPROFILE%` entries into fixed text). NSIS strings can be too short for a long PATH: check what electron-builder's NSIS build allows, or use the EnVar plugin, before writing by hand.
- **Uninstall removes exactly its own entry** and nothing else, as the association does, and is skipped on an update like the rest.
- **Tell Windows,** by broadcasting `WM_SETTINGCHANGE` ("Environment"). Terminals already open still need to be reopened; say so on the page.
- **The install folder choice** ([0161](0161-published-windows-installers-built-by-ci.md), last task) moves the PATH entry with it, so build them knowing about each other.
- **Linux is separate:** a deb can link `chd` into `/usr/bin`; an AppImage cannot. Not part of this.
- `AGENTS.md` keeps the launcher's absolute path, since the PATH is optional.

## Tasks
- [ ] ADR: PATH registration as an installer choice (replaces the "No PATH registration for now" part of ADR 0106)
- [ ] `build/installer.nsh`: the checkbox and its explanation on the options page, the PATH edit, the exact removal on uninstall, the broadcast; silent installs get the default
- [ ] A `bin` folder for the launcher (`electron-builder.yml`, `build/launchers/chd.cmd`) and what refers to the old place
- [ ] Clean-machine test: silent and wizard install, ticked and unticked, `chd --version` in a new PowerShell and in `cmd`, a PATH that already holds `%…%` entries and many entries, uninstall, an update over an install
- [ ] `docs/architecture/packaging.md`, README, CHANGELOG
- [ ] Release: with this merged, bump nothing new (`package.json` already says the next version), give the 0.8.0 changelog heading its date, and the maintainer tags `v0.8.0` on master ([CLAUDE.md](../../../CLAUDE.md), Releases); then `package.json` and the changelog move on to the next version
