# 0175: A command-line reference sheet with examples

## Status
Not Started. Logged 2026-11-05; for later.

## Goal
One page a person, or whoever writes a CI job, can keep open: every `chd` command, its options and exit codes, and worked examples, including the ones that need a pipe (a draft on standard input, a version out of git). `chd help <command>` lists usage; it does not show how the commands fit together.

## What it has
- Each command (`spec`, `validate`, `hash`, `export`, `check`, `diff`): what it is for, options, exit codes.
- Worked examples, each with its output and exit code, such as:
  - check a diagram, and check the committed version of one: `git show HEAD:docs/arch.chd | chd check - --metamodel hexagonal`;
  - review an edit: `chd diff <file>` against git, two files, or a draft on standard input;
  - validate a diagram and a metamodel file;
  - fingerprint a file before writing it back (the stale-edit check);
  - a build-pipeline step that fails on exit code 1.
- How to get `chd` on the path for each way of installing the app, and what to do where the app has no launcher.
- Windows notes: PowerShell 5.1 re-encodes text piped to a program, which can damage non-ASCII labels; PowerShell 7 and bash do not.

## Questions to settle first
- **Where it lives:** `docs/cli-reference.md`, linked from the README, and perhaps `chd help` printing a short form. Whether the app's Help menu links to it ([0174](0174-menu-review.md)).
- **How it stays true:** a test that every command and option in the help text appears in the sheet, in the manner of the parity test, so a new option cannot ship undocumented. Examples run in the test suite where they can.
- **Audience:** people who write pipelines, and the AI assistants whose skill already names these commands. One page for both, or a short form in the skill.

## Tasks
- [ ] Decide where it lives and how it is kept in step with the help text
- [ ] Write the sheet with examples and real output
- [ ] A test that fails when a command or option is missing from it
- [ ] Link it from the README and, if 0174 lands, from Help

## Notes
Raised while showing the standard-input form of `chd check` and `chd diff`: the examples only make sense next to each other.
