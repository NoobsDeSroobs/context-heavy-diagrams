# 0053: Installable distribution for non-technical users

## Status
In Progress (2026-08-23) — split into two phases (see below); Phase 1 underway on `epic/0053-installable-distribution`.

## Goal
Right now, running this app requires installing Node/npm, cloning the repo, and launching it from a terminal (`npm install`, `npm run dev`/`npm start`) — fine for the user as the developer, a hard blocker for anyone non-technical. This epic is about producing a real, double-click-to-install build: something a non-technical person can download and run without touching a terminal or knowing what npm is.

## Phase split (decided 2026-08-23)
Raised because a specific non-technical friend wants to try the app for a real brainstorming session, but real branding is still blocked on the user's own artist (not yet delivered) — "looking presentable to the public" and "runs on one friend's laptop" turned out to be genuinely different bars, so the epic splits instead of waiting on the harder one:

- **Phase 1 (now)**: a real Windows-only installer, built and handed to that one friend directly. Placeholder branding only (a working name clearly marked as a preview, not final — see below), unsigned (SmartScreen click-through accepted as fine for this use), no distribution channel/auto-update/cross-platform build. Goal is just "a real double-click install that isn't a scaffold artifact," not the polished public release.
- **Phase 2 (later, real branding)**: the actual public-facing version once the artist delivers real branding (epic 0027) — code signing, a real distribution channel, Linux build and cross-platform verification, and a decision on auto-update. The **Real open questions** below are all Phase 2, not resolved by Phase 1.

Phase 1's placeholder identity: product name **"Context-Heavy Diagram Tool (Preview)"** (window title, installer, shortcut), `package.json` name `context-heavy-diagram-tool`, appId `com.contextheavydiagramtool.app` — explicitly not a candidate final name, just something more real than the scaffold defaults it replaced. The actual product name is a live, unresolved question tied up with a real scope question (the tool may grow beyond pure diagramming — see [epic 0060](completed/0060-threat-risk-matrix.md)'s Notes) — deliberately not decided here.

**Phase 1 build result (2026-08-23): first real installer produced, `npm run build:win` worked with no changes needed beyond the placeholder identity above.** `dist/context-heavy-diagram-tool-0.1.0-setup.exe` (103 MB), a one-click NSIS installer, per-user install (no admin/UAC prompt), desktop shortcut created automatically — all already configured by the inherited scaffold, confirming this epic's own "verify, brand, and ship" framing over "build from nothing." Build log shows `signing with signtool.exe` a few times; this is `electron-builder`'s own local packaging step (asar integrity hash, timestamping), not real trust-chain code signing — no certificate is configured, so the artifact is still functionally unsigned and triggers the expected Windows SmartScreen warning on first run. Not yet actually run/installed or handed to the friend — that's the user's own next step.

**How-to written up separately**: [docs/architecture/packaging.md](../../architecture/packaging.md) — build steps, version-bump convention (stay below `1.0.0` for any Phase 1 build, see [ADR 0044](../../decisions/0044-app-versioning-scheme.md)), and confirmation that only the single `.exe` needs to travel with the recipient (it's a self-contained one-click installer; the other files `electron-builder` produces alongside it — blockmap, `latest.yml`, `win-unpacked/` — are all `electron-updater`/debug artifacts this app doesn't use yet). **Now also covers Linux** (`npm run build:linux`, AppImage/deb/snap per `electron-builder.yml`) — documented from the config, not yet actually built or verified: this project's own dev machine is Windows with no WSL/Docker installed, so the "Cross-platform verification" open question below still stands. `linux.maintainer` also updated off its scaffold default (`electronjs.org` → the same Phase 1 placeholder name) while touching that file, same placeholder-identity treatment as everything else here.

## What already exists
More scaffolding than a from-scratch effort would suggest — inherited from the original electron-vite template, not yet exercised or verified for this app specifically:
- `package.json` already has `build`, `build:unpack`, `build:win`, `build:mac`, `build:linux` scripts wired to `electron-builder`.
- `electron-builder.yml` already configures a Windows NSIS installer (with desktop shortcut), a Mac DMG, and Linux AppImage/snap/deb targets — but with scaffold-default values throughout (`appId: com.electron.app`, `productName: electron-scaffold`, generic maintainer, etc.).
- `electron-updater` is already a dependency, suggesting auto-update was anticipated by the original scaffold, though nothing here confirms it's actually wired up or tested.

So this is closer to "verify, brand, and actually ship a build" than "build packaging infrastructure from nothing" — worth checking what already works before assuming anything needs to be built.

## Relationship to epic 0027 (app branding and licensing)
Epic 0027 already explicitly flags itself as a prerequisite here: its branding section says the scaffold defaults (`electron-scaffold` name, placeholder icon) are "worth doing before any kind of external distribution... any installer build." A real installer with "electron-scaffold" as the product name and a placeholder icon would look unfinished/untrustworthy to exactly the non-technical audience this epic is for — branding should land first, or at minimum alongside this.

## Real open questions (deliberately not resolved here)
- **Distribution channel** — a downloadable file the user hosts somewhere (GitHub Releases is the obvious free option, consistent with this being a GPL-3.0 project per ADR 0011), a package manager (winget/Homebrew/apt — heavier, more infrastructure), or something else?
- **Code signing** — unsigned Windows/Mac installers trigger scary OS warnings ("unknown publisher," Gatekeeper blocks) that would undermine "non-technical people can use this" as much as no installer at all. Signing costs money (a certificate) and adds process (Apple notarization). Needs a real decision, not an assumption either way.
- **Auto-update** — `electron-updater` is already present; is wiring it up in scope here, or a separate follow-up? Not deciding this locks in extra manual-reinstall friction for every future release, worth being deliberate about rather than defaulting silently.
- **Update cadence/hosting** for whichever channel is chosen, if auto-update is in scope.
- **Cross-platform verification** — the project brief requires Linux + Windows; this epic's "done" needs a real installer tested on both, not just a Windows build because that's the primary dev machine.

## Notes
Raised together with [epic 0054](completed/0054-os-conventional-settings-storage.md) (moving app settings out of `localStorage` into a real per-OS config location) — the user explicitly linked them: a proper installed app should also store its settings where installed native apps conventionally do, not in browser storage. Not scheduled into the current batch (see [PROGRESS.md](../../../PROGRESS.md)) — flagged here so it isn't lost, not because it's next up.
