# 0147: Paste a table: bulk create with columns

## Status
Design agreed in conversation (2026-11-10), not built. Paste only; a CSV file import and connections are later steps.

## Goal
Extend the existing bulk create (right-click an element, paste lines to create one element per line, [ADR 0089](../../decisions/0089-bulk-create-from-text-list.md)) so that a pasted table, for example copied from a spreadsheet or a CMDB export, creates elements with the extra columns as tags or metadata.

## Why
The comparison page lists "no connection to a CMDB, cloud accounts or ticket trackers". A lightweight answer is to make it easy to bring a list of applications or capabilities in with their owner, environment or status already attached, without any integration.

## Design (2026-11-10)
- **One dialog.** The existing right-click bulk create takes the pasted text. One column behaves as today. Two or more columns show a preview table with a role per column and need a header row. The Shape or Container button decides the node type.
- **Roles, guessed from the header (case-insensitive), changeable in the preview:** `name`, `label`, `title` = the label; `description`, `note` = the note; `container`, `group`, `domain`, `parent` = the container (below); every other header = a tag key, the cell its value. A column can be ignored.
- **Wide, not long.** One row per element, one column per tag key (`Name, Owner, Env`). Rows with the same label merge into one element, so a long list of `name, key, value` rows works too. If one key has two values for the same label, the first wins and the result says so. A cell holding several values stays plain text.
- **Description = note** for non-empty cells, one Markdown file each; the preview says how many. Containers have no note in the app today (see Open questions).
- **Container column.** The import's row model carries a `container` field from the start. Nesting the elements into containers is a second step; until it exists the column is kept as a tag under its header's name, so nothing is lost and a highlight can already colour by it. No file-format change.
- **`relation` is not a grouping word:** it means a connection, so it belongs to the later connect step. Connections are a separate dialog (`from, to, label` rows matched to existing elements by label), not part of this paste.
- Tab-separated (from a spreadsheet) and comma-separated with quotes, parsed by a small RFC 4180 parser, no dependency. The parsing and mapping are pure code in `src/shared/`, so a `chd` command or an assistant tool can reuse them later (the stale-edit rule applies there).
- A value outside a required tag's allowed values is kept and counted in the result; a required tag with no column gets its default. One undo step for the whole paste.

## Open questions
- **A description in a container paste.** Containers have no "Open note" in the app (only entities and text), though the file format allows `data.notes` on any node. Options: keep it as a tag `description` (recommended: nothing lost, no UI change), ignore it with a notice in the preview, or give containers notes (a small separate feature).

## Related
[ADR 0089](../../decisions/0089-bulk-create-from-text-list.md).
