# 0044: App versioning scheme

## Status
Accepted

## Context
The About screen needs a real versioning scheme before it can show a version number. `package.json`'s `"version": "1.0.0"` was inherited from the original electron-scaffold template and never deliberately set — nothing reads or displays it anywhere today. There's no CI/release pipeline yet and no public distribution has ever happened, so "release" doesn't map onto any existing external event — the only real, already-existing checkpoint in this project's workflow is a PR merge to `master`.

## Decision
- **Semantic versioning (semver), stored in `package.json`'s existing `version` field** — the conventional choice, and `electron.app.getVersion()` reads it automatically, so no separate versioning mechanism is needed.
- **Reset to `0.1.0`**, not kept at the inherited `1.0.0`. Semver's own convention reserves `0.x.y` for initial development ("anything may change at any time") and `1.0.0` for the first version considered stable/public — accurate here: the app has never been distributed to anyone outside the user, and packaging for that hasn't happened. `1.0.0` is reserved for that point, not claimed early just because the scaffold template happened to start there.
- **Bumped manually per PR merge to `master`** that changes user-facing behavior — patch for fixes/small polish, minor for a new feature, no fixed cadence beyond that. No automated version-bump tooling (the CI added later only checks the build and tests, it never bumps); a manual bump as part of finishing a feature is a small, low-cost addition to a process the user already drives themselves (merging PRs).
- **`1.0.0` reserved for the first real public/installable release** — ties naturally to installable distribution landing, not to feature completeness. "MVP complete" (per `PROGRESS.md`) and "1.0.0" are treated as separate concepts on purpose: the former is a project-status label, the latter is a distribution milestone.

## Alternatives considered
- **Keep `1.0.0` as-is.** Rejected — it was never deliberately chosen, and semver's own convention for "not yet publicly released" is 0.x, which this app genuinely is.
- **Automated bumping (e.g. from commit count or git tags).** Rejected as unnecessary complexity — no CI exists to run it, and manual bumps at PR-merge time are cheap enough not to need automation yet. Worth revisiting once a packaging pipeline exists.
- **Date-based versioning (e.g. `2026.08.22`).** Rejected — semver communicates breaking-vs-additive-vs-fix intent, which is more useful for a tool with an on-disk file format (`.chd`) that needs its own compatibility story than a bare date would be.

## Addendum (2026-10-16): what 1.0.0 means
The decision above tied `1.0.0` to the first public/installable release. That is replaced: **`1.0.0` means the author considers the tool feature-complete to their vision and able to do the work they have in mind for it.** Releasing the project as open source is a 0.x event, not the 1.0.0 milestone — see [ADR 0111](0111-open-source-release-approach.md). Everything else here (semver in `package.json`, manual bumps per merge) is unchanged.

## Consequences
- `package.json`'s `version` is now `0.1.0`, and is the single source of truth — read via `app.getVersion()` in the main process, exposed to the renderer over IPC (`app:getVersion`) for the About screen rather than duplicated as a separate constant.
- Bumping is a manual step in the PR-merge workflow going forward, not enforced by tooling — worth automating once a packaging pipeline exists.
