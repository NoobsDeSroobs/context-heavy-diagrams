# Building an installer

How to produce a real, double-click-installable build of this app, for each platform this project actually targets. This covers **Phase 1 only**: an unsigned installer with placeholder branding, good enough to hand directly to a non-technical person. Phase 2 (real branding, code signing, a real distribution channel, auto-update) isn't built yet, and this doc will grow to cover it once that happens.

**Platforms**: this project's own required target is Linux + Windows (see [docs/project-brief.md](../project-brief.md)) — that's what the author actually uses and verifies. Mac is covered here too, even though nobody on this project currently uses one to test against: plenty of real users are on Mac, and there's no reason building for them should be any harder than it needs to be just because the maintainer's own machines don't include one. Treat the Mac section below the same way as Linux's — documented from `electron-builder.yml`'s existing config, not personally verified — rather than the "out of scope" framing an earlier pass gave it.

## Prerequisites

Only needed on the machine doing the *build* — whoever receives the finished installer needs nothing but their own OS:
- Node.js/npm installed, this repo cloned, `npm install` already run (the normal dev setup).
- **Build on the OS you're targeting.** `electron-builder` can cross-build in some directions with extra tooling (Docker, Wine), but nothing like that is set up in this project — a Windows build needs a Windows machine, a Linux build needs an actual Linux machine (or WSL/Docker on Windows, neither of which is currently set up on this project's own dev machine — see the Linux section below), and a Mac build needs an actual Mac — `electron-builder` doesn't cross-build macOS targets from anything else at all.

## Building a new version

1. **Bump the version** in `package.json`'s `"version"` field (semver — see [ADR 0044](../decisions/0044-app-versioning-scheme.md)). Patch for a fix, minor for a new feature. **Stay below `1.0.0`** — that ADR reserves `1.0.0` for when the tool is feature-complete to the author's vision (see its 2026-10-16 addendum), which is independent of any installer or of the open-source release.
2. Run the platform-specific script below.
3. All three scripts run `npm run build` first (typecheck + `electron-vite build`), then `electron-builder` for that platform — no manual steps in between. (`build:mac`/`build:linux` originally skipped the typecheck step, unlike `build:win` — fixed for consistency alongside writing this doc, since a build silently shipping with type errors on two platforms but not the third was clearly an oversight, not a deliberate difference.)

## Windows

```bash
npm run build:win
```

Produces `dist/context-heavy-diagrams-<version>-setup.exe` — a self-contained NSIS installer (the Electron runtime, the app, everything needed is bundled inside it). It was a one-click installer until [ADR 0108](../decisions/0108-chd-file-association-and-single-instance.md); it is now a short per-user wizard with a setup-options page (see [File association and installer options](#file-association-and-installer-options)). Built and live-tested on Windows (2026-10-15): the wizard, the options page, the association and the first-run AI seeding were confirmed working. The earlier one-click build was verified working on 2026-08-23.

**What to actually send**: just that one `.exe` file. Nothing else needs to travel with it.

`dist/` also contains a few other files `electron-builder` produces alongside it — worth knowing what they're for so it's clear none of them are required:
- `*.exe.blockmap` — block-level checksums that an auto-updater would use to compute delta updates. This app has no auto-update (the `electron-updater` dependency and the `publish` block were removed, see [ADR 0113](../decisions/0113-enforced-offline-behaviour.md)), so this file does nothing. Harmless to ignore or delete.
- `latest.yml` — an update-feed manifest, same purpose as the blockmap above; also unused. Both may stop being generated now that there is no `publish` configuration.
- `builder-debug.yml` — `electron-builder`'s own build diagnostics. Not part of the app at all.
- `win-unpacked/` — the raw unpacked app directory the installer was built from. A parallel, portable alternative to installing (`win-unpacked/context-heavy-diagrams.exe` runs directly, no install) — not needed if you're sending the installer.

**What the recipient needs to do**: the installer is unsigned (real code signing is a Phase 2 concern), so Windows SmartScreen will flag it on first run. Pass this along with the file:

1. Double-click the installer.
2. Windows shows a blue **"Windows protected your PC"** screen.
3. Click the small **"More info"** link.
4. Click **"Run anyway"**.
5. A short wizard follows: pick "just for me" (the default; no admin/UAC prompt), then the setup-options page (below), then it installs and adds a desktop shortcut.

### File association and installer options

The Windows wizard has one options page with two checkboxes, both ticked by default (`build/installer.nsh`, [ADR 0108](../decisions/0108-chd-file-association-and-single-instance.md)):

- **Open .chd diagram files with this app.** Writes the per-user `.chd` association (ProgID `ContextHeavyDiagrams.Diagram`, under `HKCUSoftwareClasses`). Untick it if another program, for example a MAME/RetroArch emulator, should keep `.chd`. The installer remembers the previous owner and the uninstaller hands it back; it only removes the `.chd` default if it still points at us.
- **Enable AI features.** The checkbox carries a warning that anything shared with an AI assistant, diagram contents included, may leave the computer. Writes `install-options.json` next to the exe; on the very first run the app turns it into the initial `aiFeaturesEnabled` preference (`seedPreferencesFromInstallOptions`). Never re-applied once a settings file exists, so an update or reinstall never undoes a later change in Preferences.

Things to expect:
- **Windows decides the default app, not the installer.** Even with the box ticked, the first double-click may show an "open with" chooser; picking "Always" there is what makes it stick. This is Windows' user-choice protection, not a bug.
- An **update** (`--updated`) skips the options page and leaves both choices alone.
- The association is deliberately *not* done through electron-builder's `fileAssociations` on Windows, because that registers unconditionally. `fileAssociations` is only set on the `mac` and `linux` sections.
- The app runs as **one instance**: double-clicking a second `.chd` while it is open opens another window in the same process (a development run skips this).
- The document icon is the app icon for now.

## Linux

```bash
npm run build:linux
```

Configured to produce three target formats (`electron-builder.yml`'s `linux.target`): **AppImage**, **deb**, and **snap**. **Not yet built or verified** — this project's own dev machine is Windows, with no WSL or Docker installed, and `deb`/`snap` packaging in particular depend on Linux-native tooling (`dpkg-deb`, `snapcraft`) that doesn't run on Windows at all; AppImage packaging is more likely to cross-build but hasn't been tried either. Run this on an actual Linux machine (or set up WSL/Docker first) and update this section with what actually happens — this is exactly the "cross-platform verification" gap the installable-distribution work already lists as a real open question, not a new one.

Expected output, based on `electron-builder.yml`'s config (unverified until an actual build confirms it):
- `dist/context-heavy-diagrams-<version>.AppImage` — a single self-contained executable, no installation step; the recipient marks it executable (`chmod +x`) and runs it directly. Closest Linux equivalent to the Windows installer's simplicity.
- `dist/context-heavy-diagrams-<version>.deb` — a Debian package (Ubuntu/Debian and derivatives), installed via `dpkg -i` or a graphical package installer.
- A `snap` package, installed via `snap install --dangerous <file>.snap` since it won't be signed/published to the Snap Store in Phase 1.

**File association (unverified)**: the `linux.fileAssociations` entry should make the deb/snap ship the `application/vnd.context-heavy-diagram+json` MIME type and list it in the desktop entry, so a file manager offers the app for `.chd`. An AppImage cannot register an association on its own (a tool such as AppImageLauncher can). Run the build on Linux and check the MIME definition and double-click, then update this paragraph.

**What to actually send**: whichever single file matches the recipient's format of choice (AppImage is the safest default — it doesn't care which distro they're on). Same principle as Windows: these are meant to be self-contained; don't assume that's confirmed until a real build has actually been run and checked.

`linux.maintainer` in `electron-builder.yml` is `Magnus Elden <…@users.noreply.github.com>` (Debian packaging wants the `Name <email>` form), using the GitHub no-reply address that is already public in the commit history.

## The Claude Desktop extension

`npm run build:extension` (run by `npm run build`, so by every platform build) produces `resources/extension/context-heavy-diagrams.mcpb` — a git-ignored build artifact that ships unpacked next to the other resources ([ADR 0110](../decisions/0110-claude-desktop-extension.md)). It bundles `extension/server.mjs` with esbuild (the MCP SDK and the skill's spec text inlined, one file, no `node_modules`), writes `extension/manifest.json` with the app's version, validates it with the official `mcpb` CLI and packs it. The `mcpb` and esbuild packages and the MCP SDK are development dependencies only.

The AI menu's "Install Claude Desktop extension…" (Windows and macOS) shows a short explanation, then asks the OS to open that file; Claude Desktop shows its own install prompt, asks for the diagram folder and offers the "modify existing files" option.

**Testing it**: `npm test` starts the real server over stdio, from source and from the esbuild bundle, with the MCP SDK's client. Manual check with Claude Desktop (done on Windows 2026-10-16: it installs and the tools work; macOS untried): use the menu item, pick a folder, confirm the tools appear, ask for a diagram, and try an update with the option on and off.

## The `chd` command-line launcher

Windows and Linux builds also carry a small `chd` launcher next to the app executable (`chd.cmd` on Windows, `chd` on Linux; `electron-builder.yml` `extraFiles`, sources in `build/launchers/`). It runs the app's own exe as plain Node (`ELECTRON_RUN_AS_NODE`) on `resources/cli/chd.mjs` — no second binary. It is **not on PATH**; see [ADR 0106](../decisions/0106-chd-command-line-tool.md) for why and what is unverified. To check a build: `dist\win-unpacked\chd.cmd --version` (after `npm run build:unpack`), or on Linux `dist/linux-unpacked/chd --version`.

## Mac

```bash
npm run build:mac
```

Produces a DMG at `dist/context-heavy-diagrams-<version>.dmg` (`electron-builder.yml`'s `dmg.artifactName`). **Not yet built or verified** — building for Mac requires an actual Mac (`electron-builder` doesn't cross-build macOS targets from Windows or Linux at all, unlike Linux's partial cross-build story above), and nobody on this project currently has one to test against. If you're building this on a Mac yourself, treat the steps below as a starting point from reading the config, not a confirmed recipe — please correct this section once you've actually run it.

Two real things worth knowing before that first attempt:

- **Gatekeeper's version of the SmartScreen warning is stricter, and the click-through is different.** An unsigned, unnotarized Mac app (this one, in Phase 1) isn't just flagged with a "run anyway" button — depending on the macOS version, either right-click (not double-click) the app and choose **"Open"** from the context menu, which offers an "Open anyway" confirmation double-click doesn't; or, on newer macOS versions, go to **System Settings → Privacy & Security**, scroll to the security section, and click **"Open Anyway"** there after the first (blocked) launch attempt. Worth testing exactly which flow applies before handing this to anyone, since guessing wrong makes the app look broken rather than just unsigned.
- **Apple Silicon vs. Intel.** `electron-builder.yml`'s `mac` section doesn't currently pin an architecture, so a plain `--mac` build likely targets whatever architecture the build machine itself is (or may need an explicit `--x64`/`--arm64`/`--universal` flag to control it — not yet confirmed). A universal binary (both architectures in one DMG) is the friendliest option for reaching both Intel and Apple Silicon users without asking which one they have, at roughly double the file size — worth deciding deliberately once this is actually being built, not defaulting to whatever happens to come out first.

One more thing worth fixing before this is taken seriously, not just before it looks polished: `mac.extendInfo` in `electron-builder.yml` requests camera, microphone, Documents, and Downloads access (`NSCameraUsageDescription` etc.) — inherited scaffold defaults from the electron-vite template, not anything this app actually uses. Requesting camera/microphone permissions for a diagramming tool would look suspicious to exactly the non-technical users this whole effort is for, and is broader access than the app needs regardless of how it looks. Trim this down to whatever this app genuinely touches (Documents/Downloads, for opening/saving `.chd` files, is plausible; camera/microphone almost certainly isn't) before a real Mac build ever goes out.

**File association (unverified)**: `mac.fileAssociations` declares the `.chd` document type, and a Finder double-click reaches the app as an `open-file` event (queued until the app is ready). Neither the DMG nor that path has been run on a Mac; verify once one is available.
