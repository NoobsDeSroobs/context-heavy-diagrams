# 0068: Privacy/security pass before public release

## Status
Not Started — not yet scoped. Raised by the user (2026-08-23) as the repo's own public release approaches, explicitly meant for "when we get closer to the public release," not now.

## Goal
A deliberate review of the app's actual privacy/security posture — permissions requested, Electron hardening defaults, network behavior — before the repo (and real installers built from it) go out to people who aren't the author. Distinct from [epic 0027](later/0027-app-branding-and-licensing.md) (branding/licensing) and [epic 0053](0053-installable-distribution.md) (packaging/code signing) — this is about what the app actually *does* and *asks for*, not what it's named or how it's signed.

## Known items, found while working on epic 0053's packaging docs (not a full audit — just what surfaced along the way)

- **Mac entitlements request camera and microphone access the app doesn't use.** `electron-builder.yml`'s `mac.extendInfo` (`NSCameraUsageDescription`, `NSMicrophoneUsageDescription`, plus `NSDocumentsFolderUsageDescription`/`NSDownloadsFolderUsageDescription`) is an inherited electron-vite scaffold default, never deliberately reviewed. The Documents/Downloads entries are plausible (opening/saving `.chd` files) — camera/microphone almost certainly aren't needed for a diagramming tool and would look suspicious to exactly the non-technical audience epic 0053 is for. Needs a real look at what the app actually touches, not an assumption either way.
- **`sandbox: false` is set explicitly** on the main `BrowserWindow`'s `webPreferences` (`src/main/windows.ts`) — a deliberate deviation from Electron's own default (`sandbox: true` since Electron 20). `contextIsolation`/`nodeIntegration` aren't set explicitly and so fall back to Electron's secure defaults (`true`/`false` respectively) — those look fine as-is. Whether `sandbox: false` is load-bearing for something the preload script needs, or just an unreviewed scaffold carry-over, isn't known yet — worth understanding *why* before deciding whether to change it.
- **Content-Security-Policy** (`src/renderer/index.html`) already looks reasonably tight — `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:` — worth one more deliberate read closer to release rather than assuming it's still accurate as the app has grown, but not a known gap today.
- **No outbound network calls exist anywhere in the app today** (confirmed by grep — no `fetch`/`XMLHttpRequest`/`net.request` in `src/`), consistent with this project's own "local, offline" design principle. Worth re-confirming this is still true right before release, not assuming it stays true as code accumulates — a single accidentally-added network call (analytics, a dependency phoning home, `electron-updater`'s own feed once wired up) would be a real, surprising regression against a design principle the project has stated from the start.
- **`package.json`'s `postinstall` runs `electron-builder install-app-deps`** and an `allowScripts` allowlist already exists for a handful of packages (`electron`, `electron-winstaller`, `esbuild`) — standard supply-chain hygiene (npm's script-blocking), already in place from the scaffold, not something new to add. Worth a fresh look at whether that allowlist is still exactly right once dependencies have moved since scaffold time, not assumed to be evergreen.

## Real open questions (deliberately not resolved here)
- Is a full manual review enough, or does this warrant an actual dependency/permission audit tool (e.g. `npm audit`, an Electron-specific security linter)?
- Does GPL-3.0-or-later (ADR 0011) carry any disclosure obligations relevant here (e.g. around bundled third-party licenses) worth checking alongside this pass rather than separately?
- Should this become a recurring pre-release checklist rather than a one-time epic, given the repo is expected to stay live and accept future changes after the first public release?

## Notes
Not scheduled into any current batch — flagged here purely so these specific findings aren't lost before the public-release pass actually happens. See [PROGRESS.md](../../../PROGRESS.md) for what's actually next.
