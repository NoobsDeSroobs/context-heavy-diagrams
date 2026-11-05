# 0142: The extension may run `git show` to read an earlier version

## Status
Accepted (2026-11-04). Widens [ADR 0110](0110-claude-desktop-extension.md), which said the extension starts no other program; completes the git form of `chd diff` ([ADR 0137](0137-chd-diff-the-same-review-without-the-app.md)) in the extension ([ADR 0138](0138-the-mcp-server-carries-the-guidance-the-cli-carries-the-checks.md)).

## Context
The most natural review of an assistant's edit is "what differs from the last commit". `chd diff <file>` does that with git; the extension could compare only two files in the folder, so an assistant had to copy the file first. The app's compare window already starts git for the same purpose, narrowly.

## Decision
- **`diff_diagrams` takes `new_path` and either `old_path` or `revision`.** With `revision` (default `HEAD`) it compares the file on disk with the same file in git, as `chd diff <file> --rev` does, through the same code as the compare window.
- **The one program the extension starts is `git show <revision>:./<file>`,** run without a shell, with the arguments as a list, outside the index (so a repository's own `core.fsmonitor` is never run), without a pager or a password prompt. A revision that starts with `-`, has a colon or a space, or is over 200 characters is refused before git is called.
- **The folder still confines it.** The diagram must be a file the folder rules allow. The repository may be above the chosen folder, because the folder is what limits the assistant, not what limits git. Notes are compared too, but a note the folder rules close (a dot-folder, a link leading out) is skipped both on disk and in git.
- **Git must be installed.** Without it the tool says so and the two-file form still works.
- **The user is told.** The install dialog and the extension's description say that git is started, read-only, and that history can bring back content since removed from the folder, which goes to the provider like everything else the assistant reads.

## Alternatives considered
- **Leave the git form with the command line.** Keeps "starts nothing" true, but the commonest review then needs a copy of the file first, and an assistant without a shell can't ask for it.
- **A git library bundled into the extension.** Avoids starting a program, at the price of a large dependency that has to read every repository format git does.
- **A general git tool (log, status, show any path).** Reads any file in history, not only a diagram under the folder rules.

## Consequences
- The extension's statement about itself becomes "no network, and no program other than `git show`".
- A repository whose history holds content the person later removed can hand it to the assistant, if it is a diagram or a note the folder rules allow. This is the cost named above, and the reason for the text in the install dialog.
- The same git code serves the app, the command line and the extension, and a test compares the command line's and the extension's results.
