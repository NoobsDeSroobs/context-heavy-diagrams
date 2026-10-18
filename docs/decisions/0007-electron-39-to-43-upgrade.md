# 0007: Electron 39 → 43 upgrade

## Status
Accepted

## Context
`npm audit` flagged a high-severity finding: [GHSA-jmr9-qjv8-65gv](https://github.com/advisories/GHSA-jmr9-qjv8-65gv), an unvalidated symlink path-traversal issue in `extract-zip`, a dependency Electron's own installer uses to unpack the downloaded Electron binary. Every published `extract-zip` version (up through the current latest, `2.0.1`) is flagged — there is no patched release to bump to. The only fix `npm audit` offers is upgrading `electron` from `^39.2.6` to `43.4.0`, which drops the vulnerable dependency entirely (replaced internally).

`extract-zip` is install-time tooling only — it's never bundled into the shipped app (it's not in `dependencies`, and `electron-builder`'s file list already excludes source/build-only files). The realistic exposure is limited to whoever runs `npm install` receiving a maliciously crafted Electron release zip, not anything reachable through the running desktop app. That said, since a "let's just live with it" decision was going to be revisited eventually anyway, and there was a natural lull between feature work to absorb any breakage, we did the upgrade now rather than deferring it — see project brief non-goals / general project philosophy of not letting dependency drift accumulate.

Two things broke doing this upgrade naively (first attempt was `npm audit fix --force`, which is what surfaced these — see below):

1. **Electron 42 removed the `postinstall` binary download.** Versions before 42 shipped a `postinstall: node install.js` script that fetched the actual Electron binary during `npm install`. Electron 42+ ships no `postinstall` script at all — the binary is meant to download "on demand," either at first run or via the package's `install-electron` bin script. `electron-vite@5.0.0` (current latest stable, predates this change) doesn't know to trigger that on-demand download itself; it just checks for the binary and throws `Error: Electron uninstall` (`getElectronPath`) if it's missing.
2. **Dialogs default to the Downloads folder.** Electron 43 changed `dialog.showOpenDialog`/`showSaveDialog` to default to the Downloads directory when no path is remembered, instead of the OS's last-used location. This project's `dialog.showOpenDialog`/`showSaveDialog` calls in [src/main/diagram.ts](../../src/main/diagram.ts) and [src/main/icons.ts](../../src/main/icons.ts) don't pass an explicit directory, so open/save dialogs will now start in Downloads every time instead of remembering where the user last was — a real, user-visible regression, not a crash.

## Decision
Upgrade `electron` to `^43.4.0` (from `^39.2.6`), and add the package's own `install-electron` bin script to our `postinstall` step so a plain `npm install` still fully sets up a working dev environment with no manual steps:

```json
"postinstall": "install-electron && electron-builder install-app-deps"
```

Audited manually against Electron's breaking-changes notes for 40/41/42/43 first (clipboard-from-renderer deprecation in 40, PDF viewer/OOPIF change in 41, macOS notification API swap in 42, dialog/rounded-corners changes in 43) — none of the removed/changed APIs are used in this codebase except the dialog default-path behavior noted above.

## Alternatives considered
- **Do nothing / accept the finding indefinitely**: reasonable given the install-time-only exposure, but the project has no dependency-hygiene process yet (see [docs/decisions/0002-planning-structure.md](0002-planning-structure.md) — nothing tracks "revisit this vulnerability later"), so it would likely just get forgotten. Since there was a natural lull between feature work, doing it now was cheaper than doing it later against a bigger, more entangled dependency tree.
- **`npm audit fix --force` as-is**: this is literally what surfaced the problem — it silently rewrote `package.json`/`package-lock.json` to `43.4.0` without flagging the `postinstall` behavior change, leaving the dev environment broken (`Electron uninstall` error) with no explanation. Rejected as a process — the *result* (43.4.0) turned out to be correct, but arriving at it should be a deliberate, tested change, not a blind `--force` run.
- **Stop at Electron 41.x** (last version before the `postinstall` removal): would dodge the binary-download problem, but 41.x is still inside the vulnerable `extract-zip` range per the advisory — doesn't actually fix the finding.

## Consequences
- `npm install` alone still fully provisions a dev environment (via the updated `postinstall`), so [README.md](../../README.md)'s setup instructions don't need to change.
- The open and save dialogs stopped remembering the last-used directory (they default to Downloads). This was fixed afterwards: the last-opened directory is kept in Preferences (`lastOpenedDirectory`) and passed as `defaultPath`.
- Future major Electron upgrades should be treated the same way: check the breaking-changes doc for the versions being crossed *before* running `npm audit fix --force`, not after.
