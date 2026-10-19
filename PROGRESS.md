# Progress

Where we are right now: a short pointer, not a log. The backlog is in [docs/planning/](docs/planning/README.md), finished epics in [docs/planning/completed-epics.md](docs/planning/completed-epics.md), decisions in [docs/decisions/](docs/decisions/), hard bugs in [docs/known-issues.md](docs/known-issues.md). History is in `git log`. Last updated 2026-10-19.

## Status

MVP complete (2026-08-20); everything in [docs/project-brief.md](docs/project-brief.md) works, plus a lot more. The current work is the **first open-source release**, [epic 0137](docs/planning/epics/0137-open-source-release.md).

## Open before going public

- Merge the pending release branches, choose the version and tag name, tag the first release.
- Make the repository public, then enable private vulnerability reporting (it is only offered on public repositories).

Merging, pushing, tagging and anything else on the remote is the maintainer's own action. The epic has the full checklist.

**Not blocking the release:** Linux and macOS verification (including Alt+drag duplicate), a real installer build under the new name, a social preview image, the light-mode colour round-trip ([known-issues](docs/known-issues.md)), [epic 0139](docs/planning/epics/0139-diagram-default-font-and-available-fonts.md) (diagram-wide default font) and [epic 0138](docs/planning/epics/later/0138-architecture-conformance-checks.md).

## Notes for the next task

- **Verifying the packaged app:** `npm run build:unpack`, launch `dist/win-unpacked/context-heavy-diagrams.exe <file.chd> --remote-debugging-port=<port>`, then drive it over the Chrome DevTools protocol (`http://127.0.0.1:<port>/json` lists pages; `Runtime.evaluate`, `Input.dispatchKeyEvent` for Ctrl+S, `Page.captureScreenshot`). Toggle the theme through `localStorage` plus a `StorageEvent`. Net activity: `--log-net-log`. The helper scripts are throwaway.
- **Dependencies:** after adding or updating one, run `npm run notices` (a test fails otherwise) and, if it has an install script, `npm approve-scripts --allow-scripts-pending` on npm 11.16+.
- **After `npm audit fix` or an Electron update**, the Electron binary can be missing: `node node_modules/electron/install.js`.
- **Icons:** edit `build/icon.svg` and run `npm run icons`; commit the regenerated files only once the SVG is final ([ADR 0122](docs/decisions/0122-app-icon-generated-from-one-svg.md)).
- The product is **Context Heavy Diagrams**, the repo `NoobsDeSroobs/context-heavy-diagrams`.
