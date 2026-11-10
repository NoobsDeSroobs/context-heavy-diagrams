# 0165: The release installs its own installer, and ships the licence beside the program

## Status
Accepted (2026-11-09). Builds on [ADR 0139](0139-releases-built-by-ci-from-a-version-tag.md).

## Context
The release workflow built the installer and published it. Whether the installer installs, whether the program in it starts and whether the uninstaller works were checked by hand on a clean machine, once. The GPL text and the third-party notices were inside `app.asar`, readable only with a tool, and the release notes did not say where the source is.

## Decision
1. **The release workflow installs the installer silently before it publishes.** `scripts/smoke-installer.mjs` runs it with `/S` into a scratch folder, checks that the program, both `chd` launchers, the licence files and `install-options.json` are there, runs `chd --version` and compares it with `package.json`, checks that the PATH was not touched ([ADR 0162](0162-the-installer-can-put-chd-on-the-path.md)), and uninstalls. A failure stops the release before anything is uploaded.
2. **A second workflow runs the same check without publishing.** It builds the installer and runs the script when `build/`, `electron-builder.yml` or the package files change in a pull request, and on demand from the Actions tab. An installer problem then shows up before a release tag, not on it.
3. **`LICENSE.txt` and `THIRD-PARTY-NOTICES.md` are installed next to the program,** beside Electron's own `LICENSE.electron.txt`, on Windows and Linux (`extraFiles` in each platform's list in `electron-builder.yml`). On macOS they are in the app's `Contents/Resources` (`extraResources`): a loose file in the root of a `.app` is a subcomponent `codesign` cannot sign, so the build fails. They are listed per platform because a top-level `extraFiles` would apply on macOS too.
4. **The release notes name the source:** a link to the tagged commit's tree, the licence (GPL-3.0-or-later) and where the notices are installed. GitHub also attaches the source archive of the tag to every release.

## Alternatives considered
- **Install to the default folder.** Closer to what a person does, but the folder name is derived by the installer, and a failing guess would hide a real failure. `/D=` fixes the folder; the default is covered by the hand test.
- **Run the smoke test on every pull request.** It builds an installer, several minutes on a Windows runner; the path filter catches what can break it.
- **Show the licence as a page in the installer.** The GPL asks for no acceptance of its terms to run the program, and a licence page would make a person click through one.
- **A written offer for the source on the release page, in place of a link.** The link to the tagged tree does the same and cannot go stale.

## Consequences
- The smoke test writes to the user hive (an uninstall entry, the `.chd` association) like a real install and removes it again. Run it on a runner or a throwaway account, not on a machine that has the app installed: it uses the same application id.
- It tests the silent path (default options). The options page and the PATH checkbox are covered by `scripts/installerPath.test.mjs` and by hand.
- Linux and macOS installers, when they are built, need their own check.
