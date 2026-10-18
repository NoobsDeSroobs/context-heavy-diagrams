# 0137: Open-source release

## Status
In progress — scoped 2026-10-16 after a demo prompted the first outside request for access. Consolidates five earlier epics (see "Folded-in epics"). The main work merged on 2026-10-18; what is left is the showcase (screenshots, icon), the remaining licensing decisions, the AI-disclosure wording and the release tag.

## Goal
Release the project as open source: public, early-adopter, still a work in progress — **not** a finished product, and not a packaged release. Early adopters build it from source. 1.0.0 stays reserved for when the author considers the tool feature-complete to their vision ([ADR 0111](../../decisions/0111-open-source-release-approach.md)).

The public repo is **this repo, history and docs included** — epics, ADRs and known issues are the project's memory, and a contributor (or their AI assistant) can answer "why is it like this?" from them. No curated clone, no second repo to keep in sync.

## Decided
- Same repo, same account — no migration and no new repository (decided 2026-10-16). The history was first meant to stay untouched; it was cleaned once before the first share instead ([ADR 0121](../../decisions/0121-history-rewritten-before-first-release.md)). `docs/` ships (ADR 0111). The release is labelled the **first open-source release**.
- **The author keeps full authority over the project's licensing.** Contributors contribute on the understanding that they gain no rights beyond the project's public license unless the author explicitly grants them. That needs a CLA (a broad license grant including the right to relicense), not a DCO — see group 4.
- **AI use is disclosed.** The README states that an AI assistant wrote a large share of the code, especially the user interface, under the author's direction, and that hand-written code also gets an AI review pass. It deliberately names no tool, so it neither promotes nor discourages any one. The copyright side of AI-written code is kept in [docs/licensing.md](../../licensing.md) only, with minimal exposure elsewhere.
- Product name: **Context Heavy Diagrams** (no hyphen). The "(Preview)" suffix is dropped; the 0.x version already says "early".
- No installers published, no code signing, no auto-update. README says: build from source.
- The security/privacy items from the old privacy epic **must** be done before going public, and the networking pass widens them (group 5).
- File/app version safety is **warn-only**: stamp the writing app version, warn when an older app opens a newer file ([ADR 0111](../../decisions/0111-open-source-release-approach.md) records the direction; the mechanism gets its own ADR when implemented).
- The known-issues log starts from a clean slate.
- CI and Dependabot are added.
- Linux verification is a good-first-contributor task, not a blocker.
- The icon waits on the user's artist. Bundled Tabler icons for entities are fine as they are.

## Tasks

### 1. Repo and docs hygiene
Hosting is settled (see Decided): the repo and account stay as they are, and the GitHub handle stays visible in the About dialog's repo link; that is accepted. The commit email in history was replaced by the GitHub no-reply address (ADR 0121).
- [x] Replace scaffold strings: `package.json` `author`/`homepage`/`repository` (done 2026-10-17, author is "Magnus Elden"); the `electron-builder.yml` `publish` URL and `dev-app-update.yml` are gone
- [~] Reread `docs/` for anything that should not be public (people, who received test builds, naming struggles): searched for names, handles, paths and personal phrases and fixed the hits (2026-10-18); the author has read all the ADRs line by line (2026-10-18); the open epics and the rest of `docs/` have had the search but no line-by-line read
- [x] Split `CLAUDE.md` (2026-10-18): `CLAUDE.md` now holds only project conventions (persistence, decision records, cross-platform, security rules, documentation, AI write paths); the maintainer's permission and collaboration rules moved to a git-ignored `CLAUDE.local.md` and are no longer in the repo (earlier commits still contain them). Original intent: keep the conventions a contributor's assistant needs (persistence, cross-platform, documentation, stale-edit check, ADR discipline); move the user-specific permission and collaboration sections out
- [x] Trim `PROGRESS.md` to a short status (2026-10-18; also collapsed the completed epics into one index, ADR 0120, and condensed known-issues). Original note: Trim `PROGRESS.md` to a short status — it is a long narrative with PR numbers that will not mean anything to a newcomer
- [ ] Tag the first open-source release (version number and tag name to be chosen; pushing the tag is the user's own action)

### 2. Name and branding
- [x] Renamed to Context Heavy Diagrams everywhere in the app, installer, launchers, extension and AI material (2026-10-17, [ADR 0114](../../decisions/0114-product-name-context-heavy-diagrams.md)). Verified: typecheck, 161 tests, packaged app launches as "Context Heavy Diagrams", `chd` launcher works, exe metadata shows the author and copyright. **Not yet done: building and installing a real installer** (the NSIS file-type registration under the new ProgID is untested)
- [x] Settings location and installer identity: both change with the name; settings do not migrate (copy the old data folder by hand) and the new installer installs next to the old one, which must be uninstalled by hand (ADR 0114)
- [x] Dropped "(Preview)"
- [x] Rename the GitHub repository to match (done by the author; the repo is now `context-heavy-diagrams`); the repo URLs in `package.json`, the README clone command, `SECURITY.md`, the issue template config and `projectInfo.ts` use the new name
- [ ] Real icon — waits on the user's artist ([epic 0027](../completed-epics.md#0027-app-branding-and-licensing)'s icon task)

### 3. README and showcase
- [x] Public README rewritten (2026-10-16): pitch, features, build-from-source, examples, AI assistants, docs map, status, AI-assisted-development disclosure, contributing placeholder, license. Wording of the AI disclosure confirmed by the author 2026-10-18; the contributing paragraph is still a draft for the author to confirm
- [x] `examples/README.md` rewritten as a visitor-facing index; gallery README status corrected; `package.json` description, `homepage`, `repository` and `bugs` set
- [ ] Screenshots and animations (the user captures them; save under `docs/images/` and uncomment the hero spot in the README). Stills for static views, short animations for interactions. Shot list: (1) still, hero: the Meridian Rail landscape in dark mode with a GDPR highlight overlay and legend; (2) animation: Ctrl/Cmd-click drill-down from the C4 context diagram to a container to a component; (3) still: the notes panel open on a node (motivation-goals); (4) animation: search with isolate dimming everything else; (5) animation or still: the security matrix rolling up through linked diagrams; (6) still: a terminal `git diff` of a `.chd` edit, to show clean diffs; (7) optional: the AI menu. Keep media small: binary files stay in git history for good (history is not rewritten again after the one-time clean-up in ADR 0121), so aim for animations of about 8 seconds, 800 px wide, under 3 MB each, or attach them through GitHub's web editor so they are hosted outside the repo
- [x] Short getting-started guide: [docs/getting-started.md](../../getting-started.md), linked from the README. Written from the menu and command names in the code, not yet checked against a running app, so the author should read it with the app open
- [ ] GitHub repository settings (the user's own action): description (use the `package.json` text), topics (e.g. `diagramming`, `architecture`, `electron`, `offline`, `c4-model`, `local-first`), social preview image once an icon exists

### 4. Licensing and notices
- [x] Third-party notices (2026-10-18, [ADR 0119](../../decisions/0119-generated-third-party-notices.md)): `THIRD-PARTY-NOTICES.md` generated by `npm run notices` for 134 shipped packages (app plus the Claude Desktop extension's bundle): 120 MIT, 10 ISC, 4 BSD-3-Clause; all GPL-compatible, checked by an allowlist and by `npm test`. Tabler Icons is named explicitly. **When installers are published:** ship the file next to the executable and link it from About
- [x] README license section (points to the notices file)
- [x] **License direction recorded** (addendum to [ADR 0011](../../decisions/0011-software-license-choice.md)): GPL-3.0-or-later stays for now; the goal is to stop abuse and theft, not to commercialise; the author keeps full authority to relicense.
- [x] **Decided 2026-10-17: a stated grant in CONTRIBUTING.md plus a PR checkbox replaces a signed CLA and bot** (ADR 0011 addendum); lawyer pass still advisable. Original analysis follows. **Contributor agreement (CLA).** To keep that authority, every contributor must grant the author a broad license to their contribution including the right to relicense it, and receive nothing in return beyond the public license. A DCO is not enough — it only certifies the right to submit under the project license. Choose between a license-grant CLA (contributors keep copyright; lighter, more acceptable) and a copyright assignment (cleanest authority; harder to sell to contributors), and a bot (e.g. CLA Assistant) to enforce it on pull requests. Decide *before* merging any outside code. A lawyer pass is advisable before relying on it.
- [x] Copyright holder: the author's own name, "Magnus Elden" (decided 2026-10-17, in the README and `package.json`; ADR 0011 addendum)
- [x] License questions settled 2026-10-18 ([ADR 0011](../../decisions/0011-software-license-choice.md), third addendum): `-or-later` stays; no trademark is claimed; AGPL stays rejected for a desktop-only product (revisit only if a hosted variant appears). A lawyer pass is still open, not a release requirement
- [x] **AI disclosure** (2026-10-18): the README section's final wording is confirmed by the author. The copyright caveat for AI-written code lives only in [docs/licensing.md](../../licensing.md); it is part of the open lawyer pass
- [x] `CONTRIBUTING.md` (personal-project stance, contribution terms, AI policy)
- [ ] SPDX/GPL headers in source files — optional

### 5. Security, privacy and networking — **must be done before going public**
- [x] macOS entitlements (2026-10-17): removed the unused camera and microphone usage strings and the `allow-dyld-environment-variables` entitlement; kept only the two JIT entitlements Electron needs, and reworded the Documents/Downloads strings to say what the app does. **Unverifiable here (no Mac):** nothing is enforced until the app is signed, but a signed build should be checked once
- [x] `sandbox: false` — it was load-bearing only for the preload's direct `clipboard` use. Sandbox is now on, clipboard goes through IPC, the broad `@electron-toolkit/preload` bridge is removed, a navigation guard keeps links in notes from loading remote pages into the app window, and all permission requests are denied ([ADR 0112](../../decisions/0112-electron-hardening-sandbox-and-navigation.md)). `typecheck`/`lint`/`npm test` clean (156 tests, 5 new), preload bundle requires only `electron`; the user ran the app afterwards and reports it works (informal); the full checklist below is not yet confirmed item by item
- [x] IPC path audit ([ADR 0115](../../decisions/0115-paths-stored-in-diagrams-are-untrusted.md)): **found and fixed a real hole** — Save could copy a file from outside the diagram folder and delete the original, driven by a `details` path in a shared `.chd`. Reproduced with failing tests first, then fixed with `containedPath`; every other write, copy and delete in `src/main` was reviewed and is safe (label-derived names, basenames, dialog-chosen paths, hashed keys). Reads of outside paths are left alone on purpose. Known limit: symlinks inside the folder
- [x] CSP re-read and tightened with `object-src`, `base-uri` and `form-action` set to `none`. Checked in the packaged app over the debugging protocol with two diagrams open: zero violations, and a deliberately injected remote image was reported as blocked (positive control). `connect-src` is left to the offline policy
- [x] **Networking pass** ([ADR 0113](../../decisions/0113-enforced-offline-behaviour.md)): measured with Chromium's net-log (found a startup `wpad` proxy-discovery lookup, now disabled via `no-proxy-server`; no spellcheck download seen on Windows), non-local requests now cancelled at the session level, and a source tripwire test covers the main process, the `chd` CLI and the Claude Desktop extension. `typecheck`/`lint` clean, `npm test` 161 (5 new); verified in a real Electron session. The user ran the app after the change and reports it works (2026-10-16, informal). **Linux/macOS unverified** (spellcheck dictionary download on Linux is the one to check; recipe in the ADR)
- [x] `npm audit` (2026-10-16): **Electron 43.4.0 had four high advisories** (sandbox inheritance, cross-origin reads, preload code-cache poisoning, webview) — updated to 43.8.0. Production dependencies now audit at **0 vulnerabilities** (before: `js-yaml` and `undici` via `electron-updater` / Electron's downloader). 14 advisories remain, all in build/dev tooling that does not ship: the `electron-builder` chain (`app-builder-lib`, `dmg-builder`, `@electron/get`, `global-agent`, `roarr`, `sprintf-js`), `tmp` via the `@inquirer` prompts used by `@anthropic-ai/mcpb`, and `node-forge` (no fix exists; used only by the extension packer's signing code, which we do not use). Revisit when `electron-builder` 27 or a new `mcpb` release lands; Dependabot will surface them. Checked after the update: `typecheck`, 161 tests, `build:unpack`, and the packaged app launches with an empty net-log
- [x] `allowScripts` re-checked (2026-10-18): it is a real npm feature (advisory in npm 11.16+, enforced in npm 12), inert on this machine's npm 11.12. Asked npm 12.2 directly (`approve-scripts --allow-scripts-pending`): nothing unreviewed; a **clean `npm ci` under npm 12.2 plus `npm run build` and `npm test` worked** (the Electron binary arrives through the root `postinstall`, which is not a dependency script). Cleaned the list: dropped the stale `electron@43.4.0` entry (Electron has no install script now), denied `electron-winstaller` (Squirrel installers, unused: we build NSIS) and the macOS-only `fsevents`; kept the two pinned `esbuild` entries (the pin goes stale on an esbuild bump, harmless as esbuild works without its script). Contributor note added to CONTRIBUTING. Original note: Re-check the `postinstall` / `allowScripts` allowlist. Note: `npm audit fix` replaced the `electron` package without running `install-electron`, so the Electron binary was missing until `node node_modules/electron/install.js` was run — contributors updating Electron hit this too (add to the contributor docs)
- [x] Removed the unused `electron-updater` dependency, the placeholder `publish` block in `electron-builder.yml`, and `dev-app-update.yml`
- [x] ADR for the enforced-offline design: [ADR 0113](../../decisions/0113-enforced-offline-behaviour.md)

### 6. File version warning
Design settled with the author 2026-10-17 ([ADR 0118](../../decisions/0118-saved-with-version-marker.md)): the file records the app version that last wrote it (`savedWith`), only ever raised; the app warns only when the file is **newer than itself**, comparing the **whole** version (a later patch can change a file too), and never for equal, older or missing markers.
- [x] ADR 0118
- [x] Pure version logic in `src/shared/appVersion.ts` (parse, compare, newer-than-app, only-ever-raised stamp, the warning text), 9 tests
- [x] `savedWith` in `DiagramFile` and `serializeDiagram` (written right after `version`); main stamps it on the multi-file save, on a new linked diagram and on required-tag propagation; the renderer keeps the loaded marker and sends it back with the save and with recovery snapshots
- [x] The warning: `src/renderer/src/fileVersionWarning.ts`, shown once per file per window through the existing alert dialog (Copy copies the project address). **Verified in the packaged app:** a file marked `9.9.9` and one marked `0.2.2` (patch only) warn against app 0.2.1; `0.2.1`, `0.1.0` and no marker do not
- [x] Lossless round-trip regression test over every `examples/*.chd` (28 files) in `src/shared/savedWith.test.mjs`
- [x] `docs/file-format.md` documents the field and the rule
- [x] **Verified in the packaged app (2026-10-17, driven over the DevTools protocol):** after an edit and File → Save, the file on disk gets `savedWith` right after `version`; a second save with the same version changes nothing; saving a file marked `9.9.9` leaves it `9.9.9`. (The logic is unit-tested; this is the end-to-end check on the real save path.)
- [x] AI material (done; `savedWith` added to the skill, field reference and primer, primer test guards it, validator accepts the field, `sync-ai` run): add `savedWith` to the skill (`resources/ai/skills/chd-diagrams/SKILL.md` and `references/field-reference.md`), the copy-paste primer (`src/shared/aiInstructions.ts`, its test guards key rules and size) and check `validate_chd.mjs` accepts the field; then `npm run sync-ai` and run the tests. The rule for assistants: leave an existing `savedWith` untouched, never invent one
- [ ] Ship this before the format changes again: applications built earlier cannot warn

### 7. Known-issues clean slate
Mostly done 2026-10-17 (details in [known-issues.md](../../known-issues.md)): lint is fully clean (cause: Windows `autocrlf` vs Prettier `endOfLine`; 21,479 warnings to zero); six old entries are Closed with an explanation or no longer reproduce; copy/paste with containers, text-node padding and clipping, legend swatches, attach-contained and click-selects-enclosing are confirmed fixed by the author; deleting a container together with its selected children now follows the author's rule, and no longer deletes the edges of the children it promotes ([ADR 0116](../../decisions/0116-deleting-a-container-and-its-selected-children.md)). Still open:
- [x] **Live test** of the new delete rule: delete only a container (children and their edges stay); select everything and delete (all gone); the same with `Ctrl+X` (done by the author, 2026-10-18)
- [x] **Property panel shows the built-in defaults** for unset style values, from data ([ADR 0117](../../decisions/0117-built-in-style-defaults-are-data.md)): verified in the packaged app for entity, container, text and edge in both themes, and the drawn look is unchanged. Live-tested by the author (2026-10-18)
- [ ] **Decision:** a colour typed in light mode comes back changed for saturated colours (typed `#ff0000`, settles on `#c83a2d`) because the theme flip is not exactly reversible; pre-existing, logged in known-issues with a proposed direction
- [x] **Paste position** fixed and measured in the packaged app (2026-10-17): a pasted entity now lands exactly on the centre of the canvas as it appears once the properties panel opens (three stacking causes, see known-issues). Live-tested by the author (2026-10-18)
- [ ] Linux-only: Alt+drag duplicate; left open until someone can test on Linux

### 8. Examples
- [x] `shape` → `entity` in all 28 `examples/*.chd` files by targeted replacements (node `type`, legend `kind`, `matrixShapeIds`/`hiddenShapeIds`; 217 line pairs, no re-save). Proven per file: the new text read raw equals what the app's loader made of the old text. Only opaque ids such as `shape-1` and ordinary prose still say "shape"
- [ ] Open a couple of the converted gallery diagrams in the app once as a sanity check (the loader accepted both forms, so this is belt and braces)

### 9. Contributor infrastructure
- [x] (written 2026-10-17, not yet run on GitHub; first push will show) CI (GitHub Actions): typecheck, lint, tests on Windows and Linux, plus `npm audit --omit=dev` as a gate for what ships
- [x] Dependabot (monthly, minor/patch grouped, majors separate; grouped, weekly or monthly) — its PRs land on the remote, so merging them is the user's own action
- [x] `SECURITY.md`; issue and PR templates (bug, feature, PR checklist). **Author to do on GitHub:** enable private vulnerability reporting (Settings → Code security) so the SECURITY.md link works
- [x] `CONTRIBUTING.md` written (setup, rules, AI policy); states the personal-project stance and the contribution terms; the PR template has the agreement checkbox

### 10. Platform verification
- [ ] Linux build and smoke test (file association, `chd` CLI, Alt+drag, AppImage/deb) — open to contributors; README states the status honestly until then
- [ ] macOS stays unverified

### Deferred (explicitly not part of going public)
Published installers or GitHub Releases, code signing / notarization, auto-update, package managers (winget, Homebrew, Flathub), a macOS build, a download page.

## Folded-in epics
This epic replaces five earlier ones, which stay in the tree marked *Superseded* so their reasoning remains readable:
- [0027](../completed-epics.md#0027-app-branding-and-licensing) — branding and licensing
- [0053](../completed-epics.md#0053-installable-distribution-for-non-technical-users) — installable distribution (its Phase 1 Windows installer is done)
- [0068](../completed-epics.md#0068-privacysecurity-pass-before-public-release) — privacy/security pass
- [0070](../completed-epics.md#0070-public-release-under-a-new-github-identity-as-a-curated-fresh-repo) — public release under a new identity
- [0115](../completed-epics.md#0115-fileapp-version-compatibility-and-data-loss-safety) — file/app version compatibility

## Notes
- Gate for "ready to open": groups 4 (notices, CLA, AI disclosure), 5, 6, 7, 8, 9 and the minimal part of 3 done. Groups 1 and 3 are expected to take the most thought.
- **Live-test checklist for the Electron hardening change (ADR 0112)** — all of it needs a real Electron run: (1) the window opens and the app works (a broken preload shows as a dead window); (2) copy and paste, including pasting into a second window and a cascading repeat paste; (3) AI → Copy AI instructions puts text on the clipboard; (4) a Markdown link in a node's note opens in the default browser and the app window stays put; (5) Help → About repo link still opens the browser; (6) dragging a `.chd` onto the window still opens it and does not navigate; (7) on Windows the "Install Claude Desktop extension…" menu item is still present; (8) Ctrl/Cmd-click on a linked-diagram node still works. Linux (clipboard, links) unverified.
- Working one task at a time, in the order the user picks; group 5 (security) is the largest hard requirement and goes first.
- What a license can and cannot do about "stealing": GPL gives a legal basis to demand source and stop closed forks, and copyright notices plus a clear license make that easier to enforce. It cannot stop copying or use, and cannot stop commercial use by others. A non-commercial license would go further but is not open source (rejected in ADR 0011).
