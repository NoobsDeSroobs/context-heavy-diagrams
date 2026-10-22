# Progress

Where we are right now: a short pointer, not a log. The backlog is in [docs/planning/](docs/planning/README.md), finished epics in [docs/planning/completed-epics.md](docs/planning/completed-epics.md), decisions in [docs/decisions/](docs/decisions/), hard bugs in [docs/known-issues.md](docs/known-issues.md). History is in `git log`. Last updated 2026-10-21.

## Status

MVP complete (2026-08-20). **v0.2.1 is the first open-source release** (2026-10-19): the repository is public, no installers are published, and early adopters build from source.

## Now

Working on [epic 0154](docs/planning/epics/0154-canvas-feature-hooks.md) (Canvas hooks, [ADR 0126](docs/decisions/0126-canvas-features-are-hooks-that-own-their-state.md)) on branch `epic/0154-canvas-feature-hooks`; epics 0152 and 0153 are merged. All the leaf hooks are done and smoke-tested, document I/O is extracted into hooks and smoke-tested, and the menu and palette builders are out of `Canvas.tsx` (now 3,890 lines). Left in the epic: the decision whether node creation and the connect/drag handlers are split too. Next, in order: [0155](docs/planning/epics/0155-end-to-end-smoke-test.md) (end-to-end test); [0156](docs/planning/epics/0156-threat-matrix-design-pass.md) is the threat matrix redesign. [Epic 0144](docs/planning/epics/0144-svg-and-command-line-export.md) (SVG and command-line export) is merged to master; its open items stay in its file. The open-source release (0137) and AI onboarding (0133) are closed in [completed-epics.md](docs/planning/completed-epics.md); their leftovers (SPDX headers, a social preview image, Linux and macOS verification, `chd` on the PATH) are listed there. SVG export (app and `chd export`) is built and tested, [ADR 0124](docs/decisions/0124-svg-export-from-a-shared-pure-renderer.md); the app's export is live-tested on Windows (dev and installed build). Still open: `chd export` from an installed build, Linux and macOS, then the PNG from the command line. Candidates after this one:

- [Epic 0139](docs/planning/epics/0139-diagram-default-font-and-available-fonts.md): a diagram-wide default font.
- The light-mode colour round-trip ([known-issues](docs/known-issues.md)).
- [Epic 0138](docs/planning/epics/later/0138-architecture-conformance-checks.md).
- **Agreed order (2026-10-21):** [epic 0144](docs/planning/epics/0144-svg-and-command-line-export.md), SVG and command-line export, first. Then imports and exports ([0052](docs/planning/epics/later/0052-drawio-import-export.md) draw.io import, [0145](docs/planning/epics/0145-read-only-html-export.md) HTML export, [0146](docs/planning/epics/0146-json-canvas-export.md) JSON Canvas export, [0147](docs/planning/epics/0147-paste-a-table-bulk-create-with-columns.md) paste a table). Then a new prioritisation. Also logged, sparse: [0148](docs/planning/epics/0148-archimate-flavoured-vocabulary-kit.md) ArchiMate kit, [0149](docs/planning/epics/0149-hollow-triangle-edge-marker.md) hollow triangle marker, [0150](docs/planning/epics/0150-visual-diff-between-versions.md) visual diff.

Merging, pushing, tagging and anything else on the remote is the maintainer's own action.

## Notes for the next task

- **Dev server after a refactor:** hot reload can leave stale state after hook or module moves (copy style, a missing arrowhead). Restart the dev server cleanly, once or twice, before trusting a failed manual test.

- **Verifying the packaged app:** `npm run build:unpack`, launch `dist/win-unpacked/context-heavy-diagrams.exe <file.chd> --remote-debugging-port=<port>`, then drive it over the Chrome DevTools protocol (`http://127.0.0.1:<port>/json` lists pages; `Runtime.evaluate`, `Input.dispatchKeyEvent` for Ctrl+S, `Page.captureScreenshot`). Toggle the theme through `localStorage` plus a `StorageEvent`. Net activity: `--log-net-log`. The helper scripts are throwaway.
- **Dependencies:** after adding or updating one, run `npm run notices` (a test fails otherwise) and, if it has an install script, `npm approve-scripts --allow-scripts-pending` on npm 11.16+. Dependabot PRs arrive on the repository.
- **After `npm audit fix` or an Electron update**, the Electron binary can be missing: `node node_modules/electron/install.js`.
- **Icons:** edit `build/icon.svg` and run `npm run icons`; commit the regenerated files only once the SVG is final ([ADR 0122](docs/decisions/0122-app-icon-generated-from-one-svg.md)).
- **Comments** cite ADRs, never epics, and state the reason, not who asked ([CLAUDE.md](CLAUDE.md)). A comment-only change can be proven by compiling the changed files before and after with comments stripped.
- The product is **Context Heavy Diagrams**, the repo `NoobsDeSroobs/context-heavy-diagrams`.
