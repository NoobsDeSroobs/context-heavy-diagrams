# 0053: Installable distribution for non-technical users

## Status
Not Started — not yet scoped. Raised by the user as an idea for later, explicitly not to be designed now.

## Goal
Right now, running this app requires installing Node/npm, cloning the repo, and launching it from a terminal (`npm install`, `npm run dev`/`npm start`) — fine for the user as the developer, a hard blocker for anyone non-technical. This epic is about producing a real, double-click-to-install build: something a non-technical person can download and run without touching a terminal or knowing what npm is.

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
Raised together with [epic 0054](0054-os-conventional-settings-storage.md) (moving app settings out of `localStorage` into a real per-OS config location) — the user explicitly linked them: a proper installed app should also store its settings where installed native apps conventionally do, not in browser storage. Not scheduled into the current batch (see [PROGRESS.md](../../../PROGRESS.md)) — flagged here so it isn't lost, not because it's next up.
