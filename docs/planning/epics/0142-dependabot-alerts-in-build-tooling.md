# 0142: Clear the open Dependabot alerts in the build tooling

## Status
Not Started. Logged 2026-10-20 from four open Dependabot alerts on the repository.

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
- [ ] Confirm each package's exposure: not in `dist/` or the extension bundle, and what `mcpb` does with `node-forge`
- [ ] Try `npm audit fix` (never `--force`) on a branch; review the lockfile diff
- [ ] For `tmp` 0.0.33, if the plain fix does not move it, decide between an `overrides` entry (and check that `external-editor` still works with it) and waiting for `mcpb`
- [ ] For `node-forge`, look for a patched release or an `mcpb` update on each pass; until one exists, decide between dismissing alert #3 with a recorded reason and replacing the dependency
- [ ] `npm run typecheck`, `npm run lint`, `npm test`, `npm run build:extension` and `npm run build:win` (or `build:unpack`) all still pass
- [ ] `npm run notices` if the lockfile changes the shipped set (a test fails otherwise)
- [ ] If an override or a dismissal is the outcome, record it in an ADR and, if it took real investigation, an entry in `docs/known-issues.md`
- [ ] The maintainer dismisses or closes alerts on GitHub himself; nothing here touches the remote

## Notes
- After `npm audit fix` or an Electron update the Electron binary can be missing: `node node_modules/electron/install.js` ([PROGRESS.md](../../../PROGRESS.md)).
- Dependency updates land one at a time; Dependabot also opens its own pull requests, so check whether one already covers an alert before changing the lockfile by hand.

## Related
[ADR 0119](../../decisions/0119-generated-third-party-notices.md) (generated notices and the license allowlist), [ADR 0110](../../decisions/0110-claude-desktop-extension.md) (the extension build), [ADR 0113](../../decisions/0113-enforced-offline-behaviour.md) (the shipped app makes no network requests).
