# 0207: Assistants and people do the same things

## Status
Not Started. Logged 2026-11-25, left over from the note file names epic (0206 in the completed index).

## Goal
A person and an assistant can do the same things and differ only in how: one element at a time or in bulk, and the format they write. Only the application writes and changes files. Neither chooses the name of a file, except a diagram itself, and a reference to a file that already exists is the only path either gives. Note file names and element ids are done; this audits the rest.

## Tasks
- [ ] Audit every assistant operation and tool that takes a `name` or a `path`, or writes a file, against what a person can do in the app. To look at: `add_new_linked_diagram` `name`, `link_to_existing_diagram` `path`, `create_file` and `update_file` (a note can be written by path), and the connection point `pointId` of `add_connection_point`.
- [ ] Decide each one: the tool derives it, or it stays and the reason is written down.
- [ ] An ADR that states the principle, and a line in the standing design rules of `CLAUDE.md` next to the stale-edit check.
- [ ] Tests, the tool descriptions, the skill and the changelog for each change.

## Notes
- Done under 0206: a note's file name is made by the application from the label and the end of the element's id, and the tool makes every id (an operation names what it makes with a handle that lives for one call, [ADR 0199](../../decisions/0199-the-tool-makes-every-id-and-an-operation-names-what-it-makes-with-a-handle.md)).
- An accepted outlier: a file made by hand outside the application.
