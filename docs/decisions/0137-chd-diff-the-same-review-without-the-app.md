# 0137: `chd diff`, the same review without the app

## Status
Decided (2026-10-27). Built and tested with the real bundle; not run from an installed build.

## Context
The review is most needed after an AI assistant edited a diagram, and the assistant is not in the app. A terminal, a CI job and an assistant that wants to tell the person what it changed need the same answer as the compare window, as text.

## Decision
**`chd diff` prints the review for two versions.** `chd diff <old.chd> <new.chd>` compares two files; `chd diff <file.chd> [--rev <revision>]` compares the file on disk with the same file in git (default `HEAD`). The classification and wording are the app's ([ADR 0133](0133-what-counts-as-a-change-in-a-review.md)), from the shared modules, so the two cannot drift. Output is plain text in review order (security, links and notes, modified, removed, added), with connections under the element that took them along, or `--json`.
- `--match` pairs replaced ids ([ADR 0136](0136-id-matching-is-a-guess-offered-on-request.md)) and says how many it paired; without it, a hint appears when matching looks needed.
- `--exit-code` exits 1 when anything changed, like `git diff --exit-code`.
- Exit codes: 0 ok, 1 changed (only with `--exit-code`), 2 usage error, 3 a version could not be read.
- Notes are compared too: for two files, the note files beside each; for git, the note at the revision. A note path that leaves the diagram's folder is never read ([ADR 0115](0115-paths-stored-in-diagrams-are-untrusted.md)).

**It only reads.** The stale-edit rule ([ADR 0109](0109-stale-edit-check-for-every-ai-write-path.md)) does not apply, and nothing can overwrite a diagram.

**It reuses the app's git reader** ([ADR 0134](0134-baselines-for-a-review-the-windows-own-copy-or-git.md)), so the build gained a `@shared` alias. Like `chd export` ([ADR 0124](0124-svg-export-from-a-shared-pure-renderer.md)) it is bundled into `resources/cli/diff.mjs` (git-ignored, built by `npm run build`) and loaded only for this command, so the other commands stay plain Node ([ADR 0106](0106-chd-command-line-tool.md)).

**An assistant is told to use it.** The bundled skill, the folder instructions and `chd`'s own help say to run `chd diff <file>` after an edit and report what changed, and that the person can see the same in the app.

## Alternatives considered
- **Show the raw `git diff`.** Hard to read for JSON and says nothing about elements.
- **A separate tool.** The classification is the app's; one engine keeps the two answers the same.
- **An image of the change.** A possible follow-up on top of the SVG renderer; not built.

## Consequences
- **Verified:** 8 tests that run the real bundle as a child process, including a temporary git repository (usage errors, exit codes, `--json`, `--match`, a revision git does not know).
- **Not verified:** the command from an installed build; Linux and macOS (the git reader and the `PATH` the command runs with); a real AI edit followed through the whole flow, since every live run used scratch copies and edits made by hand or by script.
- The skill is mirrored under `.claude/skills`; `npm run sync-ai` keeps the copy equal, and a test fails if it drifts.
