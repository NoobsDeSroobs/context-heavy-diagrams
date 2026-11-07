# 0150: `chd edit` and `chd ask` build a diagram from the command line

## Status
Accepted (2026-11-07).

## Context
[ADR 0148](0148-an-assistant-builds-a-diagram-by-operations-that-answer.md) gave the Claude Desktop extension the tools `edit_diagram`, `inspect_diagram` and `room_for_label`, which run a shared, pure core on a file. An assistant that works in a folder with a shell, or a build pipeline, does not use the extension and must not be forced to: every capability is available through both front doors, and the command line is what a pipeline relies on ([ADR 0138](0138-the-mcp-server-carries-the-guidance-the-cli-carries-the-checks.md)).

## Decision
- **`chd edit <file.chd>` runs the same operations** as `edit_diagram` and prints the same answer as JSON (path, new fingerprint, what each operation made, the layout problems so far, the validator's warnings). The operations are read from `--ops <file>` or standard input, as a list or as `{"operations": [...]}`; at most 200 in one call, all or nothing.
- **It is an AI write path and carries the stale-edit check** ([ADR 0109](0109-stale-edit-check-for-every-ai-write-path.md)): a file that does not exist is created and never overwritten; a file that exists needs `--base <fingerprint>` (`chd hash`, or the last answer) and is refused if its bytes changed, checked again right before the replacement. The extension's allowance for a diagram made earlier in the same session has no counterpart, since a command line has no session.
- **It works inside the current folder,** as the extension works inside its chosen folder: the diagram must be inside it, and a path an operation stores (a link, a note) may not lead outside it ([ADR 0115](0115-paths-stored-in-diagrams-are-untrusted.md)). A note and a new linked diagram go in a folder named after the diagram, as in the editor.
- **What it writes is checked first:** the result goes into a hidden file beside the target and through the skill's validator, and is refused with the errors if it has any. A note made for a refused edit is removed again.
- **`chd ask` answers the two read-only questions:** `chd ask inspect <file> [--styles]` (the same answer as `inspect_diagram`) and `chd ask room --label … --direction …` (the same as `room_for_label`).
- **One implementation.** The answers, the grouping of problems with their counts, the limits on a call and the compact JSON layout live in `src/shared/edit/`, used by the extension and the command line alike. A parity test runs both over the same operations and requires the same answers and the same bytes on disk.
- **The reading tools stay server-only:** `list_files`, `read_file` and `search_files` have no command, because a shell already lists, reads and searches, and the extension's own search exists because it has no shell ([ADR 0149](0149-the-extension-searches-file-text-in-process.md)). The parity test lists each with its reason, so adding a tool is a decision.
- **Exit codes:** 0 done, 1 not done (an operation was refused, the file changed, the result would be invalid, or a diagram can't be read), 2 usage error.

## Alternatives considered
- **A text format for the operations** (one line each). Easier to type, but the operations are data with nested fields; JSON is what the extension already takes and what an assistant writes without a mistake.
- **Take the base fingerprint from the file at the moment of the call.** It would make `--base` unnecessary and defeat the check: the point is the version the edit was based on.
- **Let `chd edit` reach any path.** A pipeline could want it, but an assistant-driven write path should be confined; a person can start it in a higher folder.
- **Share the file-handling code with the extension.** The two differ in what they allow (the extension's file types, dot-files, its opt-in for changing existing files); the rules are small and the parity test keeps them aligned.

## Consequences
- An assistant without the extension builds a diagram without writing its own generator script, and a pipeline can build a diagram reproducibly.
- `chd` gains two commands and one more bundle (`resources/cli/edit.mjs`, built with the others).
- A change to an operation reaches both front doors at once; a change to a front door's file handling must be made in both, which the parity test catches.
- Icons and the security matrix are not operations yet, so a diagram that needs them is still edited by hand.
