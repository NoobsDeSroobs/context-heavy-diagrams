# 0182: `validate_diagram` and `chd validate` take text too

## Status
Accepted (2026-11-16)
Supersedes: the last point of [0145](0145-a-draft-is-checked-and-compared-without-being-written.md) (`validate_diagram` stays path-only)
Superseded by: none

## Context
[0145](0145-a-draft-is-checked-and-compared-without-being-written.md) let `check_diagram` and `diff_diagrams` take a draft as text but kept `validate_diagram` path-only, because the checks for relative paths need a file's folder. The result: an assistant that has a diagram as text, in a chat with no folder or before anything is written, cannot ask whether it is well-formed. Most of the checks (duplicate ids, dangling edges, parent order, connection points, label gaps) never look at the disk.

## Decision
- **A diagram can be given as text.** `validate_diagram` takes `path` or `content`, exactly one, with the same size limit and refusals as `check_diagram`. `chd validate -` reads one diagram from standard input.
- **Text has no folder, so only the file checks are skipped.** Whether an icon, note, linked diagram or reference exists is not looked up, and the result says so (`notes` in the server, a `NOTE` line on the command line). Every structural check runs, and a diagram gives the same errors as text as it does as a file.
- **The name is part of the result,** as in 0145: `(inline)` in the server, `(stdin)` on the command line.
- **`--recursive` does nothing for text:** there are no links to follow.
- **Read-only,** so the stale-edit check ([0109](0109-stale-edit-check-for-every-ai-write-path.md)) has nothing to guard.

## Alternatives considered
- **Write a hidden temporary file and validate that** (what a write does): leaves files in the person's folder for a read-only question, and needs a folder.
- **Resolve the paths against a folder the caller names:** the point is to work with no folder.
- **Merge `validate_diagram` into `check_diagram`:** they answer different questions, whether the file is well-formed and whether it follows a metamodel.

## Consequences
- A pass on text means the structure is sound, not that its files exist; `validate_diagram` on the file, once written, still checks them.
