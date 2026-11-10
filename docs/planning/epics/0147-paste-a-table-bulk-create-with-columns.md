# 0147: Paste a table: bulk create with columns

## Status
Built (2026-11-10), to be tried by the maintainer. Paste only; connections, putting the elements into containers and a CSV file import are later steps. Design and reasons: [ADR 0168](../../decisions/0168-create-elements-from-a-pasted-table.md); the example is `examples/paste-a-table.csv`.

## Goal
Extend the existing bulk create (right-click an element, paste lines to create one element per line, [ADR 0089](../../decisions/0089-bulk-create-from-text-list.md)) so that a pasted table, for example copied from a spreadsheet or a CMDB export, creates elements with the extra columns as tags or metadata.

## Why
The comparison page lists "no connection to a CMDB, cloud accounts or ticket trackers". A lightweight answer is to make it easy to bring a list of applications or capabilities in with their owner, environment or status already attached, without any integration.

## Design (2026-11-10)
- **One dialog.** The existing right-click bulk create takes the pasted text. One column behaves as today. Two or more columns show a preview table with a role per column and need a header row. The Shape or Container button decides the node type.
- **Roles, guessed from the header (case-insensitive), changeable in the preview:** `name`, `label`, `title` = the label; `description`, `note` = the note; `container`, `group`, `domain`, `parent` = the container (below); every other header = a tag key, the cell its value. A column can be ignored.
- **Wide, not long.** One row per element, one column per tag key (`Name, Owner, Env`). Rows with the same label merge into one element, so a long list of `name, key, value` rows works too. If one key has two values for the same label, the first wins and the result says so. A cell holding several values stays plain text.
- **Description = note** for non-empty cells, one Markdown file each; the preview says how many. For a container paste the description is kept as the tag `description`, since containers have no note in the app.
- **Container column.** The import's row model carries a `container` field from the start. Nesting the elements into containers is a second step; until it exists the column is kept as a tag under its header's name, so nothing is lost and a highlight can already colour by it. No file-format change.
- **`relation` is not a grouping word:** it means a connection, so it belongs to the later connect step. Connections are a separate dialog (`from, to, label` rows matched to existing elements by label), not part of this paste.
- Tab-separated (from a spreadsheet) and comma-separated with quotes, parsed by a small RFC 4180 parser, no dependency. The parsing and mapping are pure code in `src/shared/`, so a `chd` command or an assistant tool can reuse them later (the stale-edit rule applies there).
- A value outside a required tag's allowed values (or a value for a static tag) is left at the default and counted, since the next sync would reset it; a required tag with no column gets its default. One undo step for the whole paste.

## Tasks
- [x] Parser, column roles, merge by label, tags against the required tags (`src/shared/bulk-create/`, with tests)
- [x] The dialog: list or table, preview with a role per column, warnings, notes counted
- [x] Descriptions as notes (saved as files at the next Save); container pastes keep the description as a tag
- [x] Container column carried in the row model, kept as a tag
- [x] Driven in the running app: paste, preview, create, save writes the notes
- [ ] Try it with a real spreadsheet paste (tabs) and a larger table
- [ ] Put the elements into containers from the container column (second step)
- [ ] Connections from a table: `from, to, label` rows matched to existing elements by label (own epic)
- [ ] A "Create from CSV file…" menu item over the same parser

## Related
[ADR 0089](../../decisions/0089-bulk-create-from-text-list.md).
