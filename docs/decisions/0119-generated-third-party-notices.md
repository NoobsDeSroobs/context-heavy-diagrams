# 0119: Third-party notices are generated and checked

## Status
Accepted

## Context
The app includes about 130 third-party packages (React, React Flow, the Markdown renderer, the Tabler icon set, the MCP SDK inside the Claude Desktop extension and what they depend on). MIT, ISC and BSD licenses all require the copyright and permission notice to travel with copies of the software, and the project itself is GPL-3.0-or-later, so every shipped license must also be compatible with that. A hand-written list goes stale the first time a dependency changes, and nobody would notice.

## Decision
- **`THIRD-PARTY-NOTICES.md` at the repo root is generated** by `scripts/generate-notices.mjs` (`npm run notices`): a summary table plus each package's own license file(s), verbatim. It is never edited by hand.
- **"Ships" is defined mechanically.** For the app: the `dependencies` in `package.json` plus `react` and `react-dom` (the renderer bundles them though they are listed as dev dependencies), and everything those need at runtime, found by following each package's own `dependencies` (optional and peer dependencies are not followed). For the Claude Desktop extension: the packages esbuild really bundles, read from its metafile, marked "extension only" where they are not also in the app. Build and test tooling is not listed because it is not shipped. Electron and Chromium keep their own notices, which electron-builder places next to the executable.
- **Every license is checked against an allowlist** of identifiers compatible with GPL-3.0-or-later (MIT, ISC, BSD-2/3, 0BSD, Apache-2.0, MPL-2.0, BlueOak-1.0.0, Python-2.0, CC0, Unlicense, GPL/LGPL v3+). An `OR` expression passes if one alternative is allowed, an `AND` needs all of them. A package with an unknown license, or with no license file in it, fails the run.
- **`npm test` fails if the committed file is out of date** or the check finds a problem, so adding or updating a dependency forces a regenerate and a look at the new license. CI runs the same test.
- **Tabler Icons is named explicitly** in the file even though it is loaded as data, not imported code.

## Alternatives considered
- **A license-checker package.** Another dependency to trust and keep updated for a job that is 150 lines here, and it would not know that the renderer bundles `react` from a dev dependency, nor read the extension's real bundle.
- **List only direct dependencies.** Not enough: the transitive packages are in the shipped app too, and their notices are owed as well.
- **Hand-maintained file.** Goes stale silently; rejected.
- **Include dev tooling too.** Overstates what ships and makes the file several times longer for no legal purpose.

## Consequences
- The file is large (about 170 KB) and changes whenever a version changes; that is expected churn, and Dependabot pull requests will need the regenerated file.
- Over-approximation is possible: a package reachable through `dependencies` but never actually loaded is still listed. Listing too much is safe; listing too little is not.
- Not covered: bundled non-code assets other than the Tabler icons (there are none today; a future bundled font or image set needs its own entry, see `docs/licensing.md`), and the license of Electron's own native binaries on other platforms, which electron-builder handles.
- No installers are published yet, so nothing is distributed with the file today except the source repository. When installers appear, the file must be placed next to the executable (add it to `extraFiles`) and linked from the About dialog.
- This is an engineering check, not legal advice.
