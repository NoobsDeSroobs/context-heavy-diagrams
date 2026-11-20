# Progress

Where we are right now: a short pointer, not a log. The backlog is in [docs/planning/](docs/planning/README.md), finished epics in [docs/planning/completed-epics.md](docs/planning/completed-epics.md), decisions in [docs/decisions/](docs/decisions/), hard bugs in [docs/known-issues.md](docs/known-issues.md). History is in `git log`. Last updated 2026-11-20.

## Status

MVP complete (2026-08-20). v0.2.1 was the first open-source release (2026-10-19). **v0.13.0 is the latest tag (2026-11-20); `package.json` says 0.14.0.** v0.4.0 (2026-11-03) was the first release with a Windows installer, built by CI from the tag and published on the releases page (unsigned); see [CHANGELOG.md](CHANGELOG.md). v0.3.0 added the review of changes between versions, conformance checks, SVG export and a default font for a diagram. The repository is public; Linux and macOS users build from source.

## Now

**v0.13.0 is tagged (2026-11-20):** Behaviour symbols of our own, events that start a flow or sit in one, ends with an outcome and a reach, the human step, and the first-start icon pack banner (see the changelog). **Then:** [0197](docs/planning/epics/0197-icon-pack-follow-ups.md) what icon packs left for later, [0148](docs/planning/epics/0148-archimate-flavoured-vocabulary-kit.md) ArchiMate (shrunk), [0179](docs/planning/epics/0179-align-a-connection-point-with-another-element.md) (read again: 0188 covers most of it), [0190](docs/planning/epics/0190-behaviour-parameters-repetition-and-parallel-policy.md) repetition and parallel policy (0.14.0), [0191](docs/planning/epics/0191-default-edge-style-from-the-diagrams-line-styles.md) the default edge style, the second trial round of [0168](docs/planning/epics/0168-teach-assistants-to-reroute-edges.md), and [0193](docs/planning/epics/0193-real-examples-from-futo-products.md) the examples clean-up with FUTO's products.

- **Symbol styles study** ([0200](docs/planning/epics/0200-symbol-styles-chd-and-minimalist.md)): the three-style comparison page and its survey are live; the epic is paused until the answers are in, then decides whether the app gets a second style. Parked: [0202](docs/planning/epics/later/0202-sequence-ids-and-step-through.md) sequence IDs and stepping through a diagram.
- Imports and exports: the [0052](docs/planning/epics/0052-drawio-import-export.md) draw.io export is done and the import needs a design pass (bigger than it looked); the paste-a-table follow-ups (put elements into containers, connections from a table, a CSV file) are logged in the 0147 entry of the completed epics; [0146](docs/planning/epics/0146-json-canvas-export.md) JSON Canvas export is on hold while the maintainer thinks about the mapping (notes as file cards or inline text, tags, links). [0145](docs/planning/epics/later/0145-read-only-html-export.md) HTML export is parked: the SVG export covers most of it. Then a new prioritisation. Also logged, sparse: [0148](docs/planning/epics/0148-archimate-flavoured-vocabulary-kit.md) ArchiMate kit, [0149](docs/planning/epics/0149-hollow-triangle-edge-marker.md) hollow triangle marker.

Merging, pushing, tagging and anything else on the remote is the maintainer's own action.

## Notes for the next task

- **Live-testing the compare window:** copy an example into the session scratchpad, run `npx electron-vite dev -- --remote-debugging-port=9222`, drive the pages over the DevTools protocol (the helper scripts were throwaway; the page order changes, so find the window by its URL). Stopping the background task does not stop Electron: kill the process whose command line has the debugging-port flag. A reload with unsaved edits opens a leave-page prompt that blocks the page.
- **Editing in a shell:** a heredoc loses backslashes (`\n` became a real newline and broke two files); use the Edit or Write tools for text with escapes. Prettier breaks the line after `window.api`, so searches for `window.api.method` need to allow whitespace.

- **Dev server after a refactor:** hot reload can leave stale state after hook or module moves (copy style, a missing arrowhead). Restart the dev server cleanly, once or twice, before trusting a failed manual test.

- **Verifying the packaged app:** `npm run build:unpack`, launch `dist/win-unpacked/context-heavy-diagrams.exe <file.chd> --remote-debugging-port=<port>`, then drive it over the Chrome DevTools protocol (`http://127.0.0.1:<port>/json` lists pages; `Runtime.evaluate`, `Input.dispatchKeyEvent` for Ctrl+S, `Page.captureScreenshot`). Toggle the theme through `localStorage` plus a `StorageEvent`. Net activity: `--log-net-log`. The helper scripts are throwaway.
- **Dependencies:** after adding or updating one, run `npm run notices` (a test fails otherwise) and, if it has an install script, `npm approve-scripts --allow-scripts-pending` on npm 11.16+. Dependabot PRs arrive on the repository.
- **After `npm audit fix` or an Electron update**, the Electron binary can be missing: `node node_modules/electron/install.js`.
- **Icons:** edit `build/icon.svg` and run `npm run icons`; commit the regenerated files only once the SVG is final ([ADR 0122](docs/decisions/0122-app-icon-generated-from-one-svg.md)).
- **Comments** cite ADRs, never epics, and state the reason, not who asked ([CLAUDE.md](CLAUDE.md)). A comment-only change can be proven by compiling the changed files before and after with comments stripped.
- **Editing examples and other `.chd` files:** read and write them with `parseDiagram` and `serializeDiagram` (`src/shared/diagram`), which gives the app's exact format; do not rewrite them with a shell. Check that every note and link path resolves. Several files are CRLF in the working tree and some LF: keep each file's own endings (Prettier's `endOfLine: auto` warns on a mixed file), and use the Edit tool or a pattern that tolerates `
?
`. `grep` over `$(git ls-files)` breaks on file names with spaces.
- **Versioning:** `0.14.0` is the release in progress (heading `0.14.0 (unreleased)` in the changelog); once it is tagged, bump to the next ([CLAUDE.md](CLAUDE.md), Releases).
- **Assistant guidance still to do:** [0168](docs/planning/epics/0168-teach-assistants-to-reroute-edges.md) (a second trial round after `npm run build:extension`; what to teach about routing).
- **Left open from loosely attached edges** (the completed entry for 0188 lists them): a mark on an automatic edge end, choosing one end from the menu, the connection-line preview.
- The product is **Context-Heavy Diagrams**, the repo `NoobsDeSroobs/context-heavy-diagrams`.
