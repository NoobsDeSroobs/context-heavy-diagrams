# 0134: Baselines for a review: the window's own copy, or git

## Status
Decided (2026-10-27). Built and tried on Windows; not on Linux or macOS.

## Context
A review compares a later version with an earlier one, and this tool keeps no history. Two sources are useful: the version the editor window loaded (for "what did the assistant just change"), and version control (for "what changed since the last commit or on this branch").

## Decision
Both are in **View → Changes**, with "Changes since last save" ([ADR 0102](0102-changes-since-last-save-scope.md)).

**The window's own copy.** When the file changes on disk, the "changed outside the app" banner offers **Review changes**, and the same action is **Review changes on disk**: this window's version is the earlier one, the file on disk the later. It needs no git and is exact where `HEAD` is wrong, when there was uncommitted work before the assistant edited. The editor hands both versions to the main process.

**A git revision.** **Compare with git revision…** (menu and command palette) asks for a revision (default `HEAD`; a branch, tag, commit or `HEAD~2`) and compares the file on disk with the file at that revision. Git supplies only the earlier bytes; the comparison is the id-keyed one over two whole files ([ADR 0133](0133-what-counts-as-a-change-in-a-review.md)), never a parse of a unified diff. The reader (`src/main/compare/git.ts`) is the one place the app starts another program, so it is narrow:
- only `git -c core.fsmonitor=false show <revision>:./<path>`, never a command that refreshes the index (a repository's own configuration can name a program for those, and a repository is not always trusted);
- `execFile` with an argument array, no shell; `GIT_TERMINAL_PROMPT=0` and `GIT_OPTIONAL_LOCKS=0`; a 30 s timeout and a 64 MB output limit;
- a revision is refused if it is empty, longer than 200 characters, starts with `-` (git would read an option), or contains whitespace, a colon or a control character;
- on Windows it falls back to git's default folder when `git` is not on the app's `PATH`;
- failures come back in words: git missing, not a repository, not in that revision, unknown revision.

**Notes (Details files).** With git, a note whose text changed turns its element orange with a few changed lines (`textPreview.ts`; line endings alone are not a change). Notes are read six at a time, since each one is a git process, and a path that leaves the diagram's folder is never read ([ADR 0115](0115-paths-stored-in-diagrams-are-untrusted.md)). The banner baseline cannot say a note's content changed, because the window only holds the notes it has opened; it still flags a changed note link, and git covers the content.

## Alternatives considered
- **A file-picker baseline.** Left out: a revision or the window's own copy covers the two real questions.
- **Parse `git diff` output.** A diff of the JSON text says nothing about elements and breaks on formatting; two whole files compared by id does not.

## Consequences
- **Verified:** tests against a real temporary repository, end to end; live through the real menu and palette on a scratch repository; the banner path on a scratch copy of the Meridian diagram.
- **Not verified:** Linux and macOS (`PATH` of an app started from a dock, the Windows fallback is the only one), and a very large number of notes at once (six parallel `git show` processes, not measured).
- The app now depends on `git` being installed for one feature; without it the menu item says so and the other baseline still works.
