# Progress

Where we are right now. The backlog is in [docs/planning/](docs/planning/README.md), finished epics are in [docs/planning/completed-epics.md](docs/planning/completed-epics.md), decisions in [docs/decisions/](docs/decisions/), hard bugs in [docs/known-issues.md](docs/known-issues.md). History is in `git log`. Last updated 2026-10-18.

## Status

MVP complete (2026-08-20); everything in [docs/project-brief.md](docs/project-brief.md) works, plus a lot more. The current work is preparing the **first open-source release**.

## Current: epic 0137, open-source release

The first branch merged on 2026-10-18; the follow-up work is on `epic/0137-release-docs`. Merging, pushing, tagging and anything else on the remote is the maintainer's own action. The epic [0137](docs/planning/epics/0137-open-source-release.md) holds the full task list with what is done; the groups below are what is still open.

**Docs clean-up (done 2026-10-18):** completed epics collapsed into an index ([ADR 0120](docs/decisions/0120-completed-epics-collapse-into-an-index.md)), solved entries in `docs/known-issues.md` condensed, ADRs given a light pass (stale epic wording, TBDs, outdated status lines; the content is untouched), a project name and a personal detail removed. The author has read all the ADRs line by line; the open epics and the rest of `docs/` have been searched for names, emails and paths but not read line by line.

**Git history rewrite (done 2026-10-18):** the history was cleaned of project-specific content and the author's personal address, keeping all commits ([ADR 0121](docs/decisions/0121-history-rewritten-before-first-release.md)), and force-pushed. The hosting repository was then recreated from the rewritten `master` alone, because the old one kept the old commits in its pull-request refs; older `PR #NNN` mentions refer to the former repository.

**Needs the maintainer:**
- Optionally ask the artist for a 1280×640 social preview image for the GitHub page.
- Screenshots and animations (shot list in the epic), read the new [getting-started guide](docs/getting-started.md) with the app open (it was written from the code), GitHub repository settings (description, topics), enable private vulnerability reporting, tag the first release.
- Push once so CI runs for the first time; the Linux job is untested.
- Live test still pending: opening a couple of the converted gallery examples. (The delete rule, paste centring and the property panel defaults were tested on 2026-10-18.)
- Decisions: no lawyer pass is needed, and `-or-later`, no trademark and the README's AI disclosure were settled on 2026-10-18. A colour typed in light mode that comes back changed for saturated colours stays a known issue, to be fixed after the release.

**Not blocking the release:** Linux and macOS verification (including Alt+drag duplicate), a real installer build under the new name, [epic 0139](docs/planning/epics/0139-diagram-default-font-and-available-fonts.md) (diagram-wide default font) and [epic 0138](docs/planning/epics/later/0138-architecture-conformance-checks.md).

## Notes for the next task

- **Verifying the packaged app:** `npm run build:unpack`, launch `dist/win-unpacked/context-heavy-diagrams.exe <file.chd> --remote-debugging-port=<port>`, then drive it over the Chrome DevTools protocol (`http://127.0.0.1:<port>/json` lists pages; `Runtime.evaluate`, `Input.dispatchKeyEvent` for Ctrl+S, `Page.captureScreenshot`). Toggle the theme through `localStorage` plus a `StorageEvent`. Net activity: `--log-net-log`. The helper scripts are throwaway.
- **Dependencies:** after adding or updating one, run `npm run notices` (a test fails otherwise) and, if it has an install script, `npm approve-scripts --allow-scripts-pending` on npm 11.16+.
- **After `npm audit fix` or an Electron update**, the Electron binary can be missing: `node node_modules/electron/install.js`.
- The product is **Context Heavy Diagrams**, the repo `NoobsDeSroobs/context-heavy-diagrams`.
