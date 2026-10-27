# Progress

Where we are right now: a short pointer, not a log. The backlog is in [docs/planning/](docs/planning/README.md), finished epics in [docs/planning/completed-epics.md](docs/planning/completed-epics.md), decisions in [docs/decisions/](docs/decisions/), hard bugs in [docs/known-issues.md](docs/known-issues.md). History is in `git log`. Last updated 2026-10-27.

## Status

MVP complete (2026-08-20). **v0.2.1 is the first open-source release** (2026-10-19): the repository is public, no installers are published, and early adopters build from source.

## Now

**In progress:** [0150](docs/planning/epics/0150-visual-diff-between-versions.md) (review changes between two versions), on `epic/0150-visual-diff-between-versions`, all built and tried live (details and per-task results are in the epic file); see **Restart point** below. [0138](docs/planning/epics/0138-architecture-conformance-checks.md) (conformance checks) is merged (#14). Parked for later: [0155](docs/planning/epics/0155-end-to-end-smoke-test.md) (end-to-end test) and [0156](docs/planning/epics/0156-threat-matrix-design-pass.md) (threat matrix redesign). Epic 0139 (diagram default font, [ADR 0130](docs/decisions/0130-diagram-default-font-and-installed-fonts.md)) is merged; what is left of it is a Linux and macOS check of the installed-font list and an optional Diagnostics warning. The light-mode colour round-trip is closed as won't fix ([known-issues](docs/known-issues.md)). [Epic 0144](docs/planning/epics/0144-svg-and-command-line-export.md) (SVG and command-line export) is merged to master; its open items stay in its file. The open-source release (0137) and AI onboarding (0133) are closed in [completed-epics.md](docs/planning/completed-epics.md); their leftovers (SPDX headers, a social preview image, Linux and macOS verification, `chd` on the PATH) are listed there. SVG export (app and `chd export`) is built and tested, [ADR 0124](docs/decisions/0124-svg-export-from-a-shared-pure-renderer.md); the app's export is live-tested on Windows (dev and installed build). Still open: `chd export` from an installed build, Linux and macOS, then the PNG from the command line. Candidates after this one:

- Imports and exports ([0052](docs/planning/epics/later/0052-drawio-import-export.md) draw.io import, [0145](docs/planning/epics/0145-read-only-html-export.md) HTML export, [0146](docs/planning/epics/0146-json-canvas-export.md) JSON Canvas export, [0147](docs/planning/epics/0147-paste-a-table-bulk-create-with-columns.md) paste a table). Then a new prioritisation. Also logged, sparse: [0148](docs/planning/epics/0148-archimate-flavoured-vocabulary-kit.md) ArchiMate kit, [0149](docs/planning/epics/0149-hollow-triangle-edge-marker.md) hollow triangle marker, [0150](docs/planning/epics/0150-visual-diff-between-versions.md) visual diff.

Merging, pushing, tagging and anything else on the remote is the maintainer's own action.

## Restart point: epic 0150 (2026-10-27)

Built, tested, tried live and documented: ADRs [0132](docs/decisions/0132-the-compare-window-is-a-read-only-canvas-with-its-own-bridge.md) to [0137](docs/decisions/0137-chd-diff-the-same-review-without-the-app.md). Branch `epic/0150-visual-diff-between-versions`, clean at the last commit (`git log --oneline master..HEAD`). `npm run typecheck`, `npm run lint` and `npm test` pass (455 of 456 node tests; the skipped one cannot create symlinks on this Windows machine). The View menu groups the three review commands under **Changes**. A blind test and a simulated assistant edit of the Meridian diagram (scratch copy) were reviewed by the maintainer; the conformance delta is left out on purpose (ADR 0133).

Left for the maintainer: accept the epic, then the epic collapses into [completed-epics.md](docs/planning/completed-epics.md) and its file is deleted. Not verified, listed in the epic's "Verification status": a real AI edit through the whole flow, Linux and macOS, many notes at once. The version is bumped to 0.3.0 on this branch; the tag and the release are the maintainer's.

## Notes for the next task

- **Live-testing the compare window:** copy an example into the session scratchpad, run `npx electron-vite dev -- --remote-debugging-port=9222`, drive the pages over the DevTools protocol (the helper scripts were throwaway; the page order changes, so find the window by its URL). Stopping the background task does not stop Electron: kill the process whose command line has the debugging-port flag. A reload with unsaved edits opens a leave-page prompt that blocks the page.
- **Editing in a shell:** a heredoc loses backslashes (`\n` became a real newline and broke two files); use the Edit or Write tools for text with escapes. Prettier breaks the line after `window.api`, so searches for `window.api.method` need to allow whitespace.

- **Dev server after a refactor:** hot reload can leave stale state after hook or module moves (copy style, a missing arrowhead). Restart the dev server cleanly, once or twice, before trusting a failed manual test.

- **Verifying the packaged app:** `npm run build:unpack`, launch `dist/win-unpacked/context-heavy-diagrams.exe <file.chd> --remote-debugging-port=<port>`, then drive it over the Chrome DevTools protocol (`http://127.0.0.1:<port>/json` lists pages; `Runtime.evaluate`, `Input.dispatchKeyEvent` for Ctrl+S, `Page.captureScreenshot`). Toggle the theme through `localStorage` plus a `StorageEvent`. Net activity: `--log-net-log`. The helper scripts are throwaway.
- **Dependencies:** after adding or updating one, run `npm run notices` (a test fails otherwise) and, if it has an install script, `npm approve-scripts --allow-scripts-pending` on npm 11.16+. Dependabot PRs arrive on the repository.
- **After `npm audit fix` or an Electron update**, the Electron binary can be missing: `node node_modules/electron/install.js`.
- **Icons:** edit `build/icon.svg` and run `npm run icons`; commit the regenerated files only once the SVG is final ([ADR 0122](docs/decisions/0122-app-icon-generated-from-one-svg.md)).
- **Comments** cite ADRs, never epics, and state the reason, not who asked ([CLAUDE.md](CLAUDE.md)). A comment-only change can be proven by compiling the changed files before and after with comments stripped.
- The product is **Context Heavy Diagrams**, the repo `NoobsDeSroobs/context-heavy-diagrams`.
