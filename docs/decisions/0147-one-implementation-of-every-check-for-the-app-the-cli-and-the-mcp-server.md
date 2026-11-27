# 0147: One implementation of every check, for the app, the command line and the assistant tools

## Status
Accepted (2026-11-05). Reworded 2026-11-26 to state the principle: the app, `chd` and the MCP server behave as one, and this is how a check is kept that way.

## Context
The skill's script (`validate_chd.mjs`) is plain Node that must run where there is no build and no `node_modules`: from a checkout, from the folder the app installs it into, and from the repository's own `.claude` copy. `chd validate` and the extension import it. A check the app needs as well (the label clearance, for the Diagnostics panel) is written in the app's TypeScript, with its aliases and shared helpers, which the script cannot import. Writing it twice lets the two answers drift, and then a person and an assistant are told different things about the same diagram.

## Decision
- **A check the app and an assistant both rely on has one source,** pure TypeScript in `src/shared/<feature>/`. The app, `chd`, the MCP server and the skill's script all run that code, so they cannot disagree about what is wrong with a diagram.
- **The skill's script gets a generated copy.** `scripts/build-cli.mjs` bundles the source with esbuild into a plain `.mjs` file next to the script (`scripts/label_clearance.mjs`) with a banner saying it is generated; the script imports that file.
- **The generated copy is committed,** unlike the command-line bundles, which are git-ignored: the script has to run in a fresh checkout and in the installed skill folder without a build. A test builds a fresh copy and fails if the committed one differs (line endings aside); `npm run build:cli` regenerates it.
- **The same applies to any later check shared this way.**

## Alternatives considered
- **Write the check twice.** No build step, but the app and the command line would disagree sooner or later.
- **Import the script from the app.** It works only through the app's bundler, and the script's own imports are Node's.
- **Generate the copy when the skill is installed.** The repository's own copy and the extension would each need a build step.
- **A git-ignored build output.** The script would fail in a fresh checkout until someone built it.

## Consequences
- Changing the source means running `npm run build:cli` and committing the copy; the test says so when it is forgotten.
- The copy is plain JavaScript with no dependencies, so it runs under any Node the skill supports.
