# 0027: App branding and licensing

## Status
In Progress — licensing decision made and core files landed ([ADR 0011](../../decisions/0011-software-license-choice.md)); branding (name/icon) not started.

## Goal
Replace the default electron-vite scaffold identity (window title, taskbar/dock icon, app name, `package.json` metadata) with the tool's own, and put real licensing terms in place — right now the project has no LICENSE file and every branding field is still the generic scaffold default.

## Design

### Branding
Not yet designed — no name or icon concept has been chosen. Needs a real product name (working title only so far: "context-heavy-diagram-tool"/"electron-scaffold" in package.json) and an actual icon asset before implementation. Low priority/low risk — cosmetic, doesn't block other work — but worth doing before any kind of external distribution (epic 0019's icon-pack licensing outreach, any installer build) so early testers/reviewers aren't looking at "electron-scaffold".

Known touch points (confirmed by grep, not yet changed):
- `package.json` — `"name": "electron-scaffold"`, `"author": "example.com"`, `"description"`, `"homepage"` all still scaffold defaults
- `electron-builder.yml` — `appId: com.electron.app`, `productName: electron-scaffold`
- `resources/icon.png` — scaffold placeholder icon, referenced from [src/main/index.ts](../../../src/main/index.ts) (only wired up for Linux window icon; Windows/Mac icon comes from electron-builder's packaging config instead)
- Window title currently comes from `index.html`'s `<title>` (not yet checked in detail)

### Licensing
Decided and largely landed — see [ADR 0011](../../decisions/0011-software-license-choice.md) for the full reasoning. Summary: GPL-3.0-or-later (copyleft — commercial use is fine, closed-source forks are not), sole-copyright-holder dual-licensing option kept open for later, `AGPL`/non-commercial/BSL alternatives considered and rejected for this project's scope.

Already done:
- [`LICENSE`](../../../LICENSE) — canonical GPL-3.0 text, fetched verbatim from gnu.org
- `package.json` `"license": "GPL-3.0-or-later"` field added

Still open (see Tasks) — mechanical/paperwork items the ADR flagged but didn't resolve.

## Tasks

**Branding:**
- [ ] Pick a product name
- [ ] Commission/produce an actual app icon (multiple sizes/formats — `.ico` for Windows, `.icns` for Mac, `.png` for Linux)
- [ ] Update `package.json` name, description, author, homepage
- [ ] Update `electron-builder.yml` (`appId`, `productName`)
- [ ] Replace `resources/icon.png` and any platform-specific icon files electron-builder expects
- [ ] Update window `<title>` / anywhere else the old scaffold name is hardcoded
- [ ] Verify on both Windows and Linux (cross-platform is a hard requirement per the project brief) — taskbar icon, window title bar, alt-tab, installer output

**Licensing:**
- [x] Decide license terms — [ADR 0011](../../decisions/0011-software-license-choice.md)
- [x] Add `LICENSE` file (GPL-3.0 canonical text)
- [x] Add `package.json` `license` field
- [ ] Add a short copyright/license header to source files (FSF's own GPL guidance recommends one per file) — mechanical, touches most of `src/`, worth a dedicated pass rather than doing it file-by-file elsewhere
- [ ] Add a license/copyright section to the README (once one exists — no README currently reviewed for this) stating GPL-3.0-or-later and pointing at `LICENSE`
- [ ] Write down the dual-licensing intent somewhere real (e.g. a short note in `docs/licensing.md` or a new `LICENSING.md`) — right now it's only recorded in ADR 0011, not anywhere a prospective commercial licensee or contributor would see it
- [ ] Decide the contributor story before accepting any outside PR: without a CLA (or an equivalent contributor agreement granting relicensing rights), an outside contributor's copyright share can't be included in a separate commercial license — directly blocks the dual-licensing goal the moment it happens. Not urgent while the user is the sole contributor, but a real gap the instant that changes.

## Notes
Licensing half of this epic was scoped and mostly executed in one pass (2026-08-19) after the user raised it as a follow-on to the branding epic — protecting the project from being forked into a closed-source, for-profit product, while still allowing commercial use, was the explicit goal (confirmed via direct question: copyleft over non-commercial-only, and dual-licensing kept open). See [ADR 0011](../../decisions/0011-software-license-choice.md) for the full alternatives analysis (AGPL, non-commercial, BSL all considered and rejected for this project's specific scope — desktop-only, no server/SaaS variant).

Not legal advice — IANAL. Worth a real lawyer's pass before any commercial dual-licensing actually happens, and especially before accepting outside contributions under an unwritten assumption about relicensing rights.
