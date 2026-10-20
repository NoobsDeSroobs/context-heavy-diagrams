# Progress

Where we are right now: a short pointer, not a log. The backlog is in [docs/planning/](docs/planning/README.md), finished epics in [docs/planning/completed-epics.md](docs/planning/completed-epics.md), decisions in [docs/decisions/](docs/decisions/), hard bugs in [docs/known-issues.md](docs/known-issues.md). History is in `git log`. Last updated 2026-10-19.

## Status

MVP complete (2026-08-20). **v0.2.1 is the first open-source release** (2026-10-19): the repository is public, no installers are published, and early adopters build from source.

## Now

Nothing active; branch `epic/0140-legend-line-picker` (the legend line picker, live-tested) waits for the maintainer's merge. [Epic 0137](docs/planning/epics/0137-open-source-release.md), the release, is shipped; its leftovers are optional or for contributors (SPDX headers, a social preview image, Linux and macOS verification, a line-by-line read of the open epics). Candidates for the next piece of work:

- [Epic 0139](docs/planning/epics/0139-diagram-default-font-and-available-fonts.md): a diagram-wide default font.
- [Epic 0142](docs/planning/epics/0142-dependabot-alerts-in-build-tooling.md): the four open Dependabot alerts, all in build tooling.
- The light-mode colour round-trip ([known-issues](docs/known-issues.md)).
- [Epic 0138](docs/planning/epics/later/0138-architecture-conformance-checks.md).
- [Epic 0141](docs/planning/epics/0141-comparison-with-other-tools.md): a page comparing this tool with other diagramming tools, linked from the README.

Merging, pushing, tagging and anything else on the remote is the maintainer's own action.

## Notes for the next task

- **Verifying the packaged app:** `npm run build:unpack`, launch `dist/win-unpacked/context-heavy-diagrams.exe <file.chd> --remote-debugging-port=<port>`, then drive it over the Chrome DevTools protocol (`http://127.0.0.1:<port>/json` lists pages; `Runtime.evaluate`, `Input.dispatchKeyEvent` for Ctrl+S, `Page.captureScreenshot`). Toggle the theme through `localStorage` plus a `StorageEvent`. Net activity: `--log-net-log`. The helper scripts are throwaway.
- **Dependencies:** after adding or updating one, run `npm run notices` (a test fails otherwise) and, if it has an install script, `npm approve-scripts --allow-scripts-pending` on npm 11.16+. Dependabot PRs arrive on the repository.
- **After `npm audit fix` or an Electron update**, the Electron binary can be missing: `node node_modules/electron/install.js`.
- **Icons:** edit `build/icon.svg` and run `npm run icons`; commit the regenerated files only once the SVG is final ([ADR 0122](docs/decisions/0122-app-icon-generated-from-one-svg.md)).
- **Comments** cite ADRs, never epics, and state the reason, not who asked ([CLAUDE.md](CLAUDE.md)). A comment-only change can be proven by compiling the changed files before and after with comments stripped.
- The product is **Context Heavy Diagrams**, the repo `NoobsDeSroobs/context-heavy-diagrams`.
