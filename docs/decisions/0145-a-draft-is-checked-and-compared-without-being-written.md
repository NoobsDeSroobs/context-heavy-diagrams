# 0145: A draft is checked and compared without being written

## Status
Accepted (2026-11-05). Extends the two front doors of [ADR 0138](0138-the-mcp-server-carries-the-guidance-the-cli-carries-the-checks.md); the git form is [ADR 0142](0142-the-extension-may-run-git-show-to-read-an-earlier-version.md).

## Context
An assistant that drafts a diagram wants to judge it before it exists on disk: does it conform, what would it change. Both tools took only paths, so a draft had to be written under another name first, which leaves files behind and, to replace one, needs the person's opt-in to modify files.

## Decision
- **A diagram can be given as text.** `check_diagram` takes `path` or `content`; `diff_diagrams` takes each version as a path or as text (`old_path` / `old_content`, `new_path` / `new_content`). On the command line a single `-` stands for standard input in `chd check` and for one of the two files in `chd diff`. Exactly one source per side; a revision still compares a file on disk with git, so a text version has to be compared with another version, not with git.
- **Notes are not compared when a version is text.** A note is a file beside a diagram, and a text version has no folder; comparing one side's notes with none would report every note as added or removed. The links to notes are still compared. The paths inside a text diagram are never read.
- **The same limit as a file:** 5 MB of text for the server.
- **The name is part of the result:** `(stdin)` on the command line, `(inline)` / `old content` / `new content` in the server, because only one of them has a standard input. The reviews are otherwise identical, and a test compares them.
- **`validate_diagram` stays path-only.** Its checks are about relative paths (icons, notes, linked diagrams), which resolve against a file's folder; a text version has none.

## Alternatives considered
- **Write the draft first.** What this replaces: it leaves files behind and needs update rights for a replacement.
- **A hidden temporary file in the folder,** as a write is validated. It would let `validate_diagram` take text too, but it creates files in the person's folder for a read-only question.
- **Compare notes by string for a text side.** Needs a folder to find them in; the answer would differ between the front doors.

## Consequences
- Both tools stay read-only, so the stale-edit check ([ADR 0109](0109-stale-edit-check-for-every-ai-write-path.md)) has nothing to guard.
- A draft's own structural problems (a dangling edge, a duplicate id) are found by the write-time validation or `validate_diagram` once the file exists, not by these tools.
