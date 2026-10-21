# 0142: Clear the open Dependabot alerts in the build tooling

## Status
In Progress. Logged 2026-10-20 from open Dependabot alerts on the repository (four at first, a fifth the same day). The exposure checks are done (see Findings); what is left is the decision on what to change.

## Goal
Get the open alerts to zero, or dismissed with a recorded reason, without breaking the installer build or the Claude Desktop extension build, and without touching what ships in the app.

## What the alerts are (checked 2026-10-20)
All four are in the **development** scope: none of these packages is in the shipped app. `npm audit --omit=dev` reports 0 vulnerabilities; the full `npm audit` reports 14, which are these four packages plus the packages that depend on them.

| Alert | Package | Severity | Reached through | Fix |
|---|---|---|---|---|
| #3 | `node-forge` 1.4.0, RSA PKCS#1 v1.5 signature verification accepts extra nested DigestAlgorithm elements | high | `@anthropic-ai/mcpb` (builds the Claude Desktop extension bundle) | None yet: 1.4.0 is the latest release and `npm audit` says no fix is available |
| #2, #1 | `tmp` 0.0.33, path traversal via prefix/postfix and arbitrary write through a symlinked `dir` | high, low | `mcpb` → `@inquirer/prompts` → `@inquirer/editor` → `external-editor`, which pins `^0.0.33` | `npm audit fix` reports a fix; the other copy, `tmp` 0.2.7 under `tmp-promise` (electron-builder), is already past the affected range |
| #4 | `sprintf-js` 1.1.3, denial of service through unbounded precision specifiers | moderate | `electron-builder` → `app-builder-lib` → `@electron/get` → `global-agent` → `roarr` | `npm audit fix` reports a fix |

## Exposure
- The vulnerable code runs on the maintainer's machine during `npm run build:extension` and the installer builds, not in the app and not in the extension that users install. Whether the extension bundle itself contains any of these packages still has to be checked (the notices list covers 134 shipped packages).
- `node-forge` signature verification is the risky operation of alert #3. What `mcpb` uses it for (signing a bundle, verifying one, or neither on our path) has to be read in its source before calling the alert harmless.
- `tmp` and `sprintf-js` need attacker-controlled input to a build tool, which this repository does not give them.

## Tasks
- [x] Confirm each package's exposure: not in `dist/` or the extension bundle, and what `mcpb` does with `node-forge`
- [x] Try `npm audit fix` (never `--force`) on a branch; review the lockfile diff (dry run: it changes nothing, see Findings)
- [ ] For `tmp` 0.0.33, if the plain fix does not move it, decide between an `overrides` entry (and check that `external-editor` still works with it) and waiting for `mcpb`
- [ ] For `node-forge`, look for a patched release or an `mcpb` update on each pass; until one exists, decide between dismissing alert #3 with a recorded reason and replacing the dependency
- [ ] `npm run typecheck`, `npm run lint`, `npm test`, `npm run build:extension` and `npm run build:win` (or `build:unpack`) all still pass
- [ ] `npm run notices` if the lockfile changes the shipped set (a test fails otherwise)
- [ ] If an override or a dismissal is the outcome, record it in an ADR and, if it took real investigation, an entry in `docs/known-issues.md`
- [ ] The maintainer dismisses or closes alerts on GitHub himself; nothing here touches the remote

## Findings (2026-10-20)
- **Not shipped.** None of `node-forge`, `tmp` or `sprintf-js` is in the packaged app (the archive's 18,860 entries contain no path with them), in the extension bundle (0 matches in the esbuild output, which bundles only `extension/server.mjs` and its imports), or in `THIRD-PARTY-NOTICES.md`. `@anthropic-ai/mcpb` and `electron-builder` are devDependencies.
- **`node-forge` is never exercised.** `mcpb` uses it only in `sign.js` (`signMcpbFile`, `verifyMcpbFile`), reached from the `sign`, `verify` and `info` commands. `scripts/build-extension.mjs` runs only `validate` and `pack`, and `pack` does not sign. The vulnerable signature verification does not run in this repository.
- **`tmp` 0.0.33** is used by `external-editor`, which only the `@inquirer` editor prompt reaches (an interactive `mcpb` command, not `validate` or `pack`). Nothing here passes it a `prefix`, `postfix` or `dir`.
- **`sprintf-js`** sits under `roarr`, used by `global-agent` inside `@electron/get` when electron-builder downloads Electron.
- **`npm audit fix` changes nothing** (dry run: 0 added, 0 removed, 0 changed), although the report says "fix available" for `tmp` and `sprintf-js`.
- **No patched release exists** for `node-forge` (affected `<=1.4.0`, latest is 1.4.0) or `sprintf-js` (affected `<=1.1.3`, latest is 1.1.3). An override cannot fix either. `tmp` has patched releases (0.2.6 and later; 0.2.7 is already used by `tmp-promise`), so an override of the copy under `external-editor` (pinned `^0.0.33`) is possible, but a parent update would be cleaner (`mcpb` 2.1.2 is the latest and pins `@inquirer/prompts` 6).
- **Alert #5 (added the same day) is a real fix, now done.** It is titled "launch-editor: escapeCmdArgs() omits % escaping on Windows" but the affected package is `vite` (a direct dev dependency, vulnerable `>= 7.0.0, <= 7.3.6`, patched 7.3.7). The dev server's open-in-editor feature is the affected code, so it matters only for `npm run dev` on Windows. `npm update vite` moved the lockfile from 7.3.6 to 7.3.7 within the existing `^7.2.6` range, with no `package.json` change; typecheck, lint, tests and `npm run build` pass. `npm audit` did not list this advisory at the time, so the GitHub alert is the only place it shows.
- **Unrelated, noticed on the way:** the packaged `app.asar` contains the whole `docs/` tree, planning documents included. Check whether that is intended.

## Notes
- After `npm audit fix` or an Electron update the Electron binary can be missing: `node node_modules/electron/install.js` ([PROGRESS.md](../../../PROGRESS.md)).
- Dependency updates land one at a time; Dependabot also opens its own pull requests, so check whether one already covers an alert before changing the lockfile by hand.

## Related
[ADR 0119](../../decisions/0119-generated-third-party-notices.md) (generated notices and the license allowlist), [ADR 0110](../../decisions/0110-claude-desktop-extension.md) (the extension build), [ADR 0113](../../decisions/0113-enforced-offline-behaviour.md) (the shipped app makes no network requests).
