# 0168: Create elements from a pasted table

## Status
Accepted (2026-11-10). Extends [ADR 0089](0089-bulk-create-from-text-list.md): a paste of one label per line works as it did. Creating connections from a table, putting the elements into containers, and a CSV file import are not covered.

## Context
Bringing a list of applications or capabilities into a diagram with their owner, environment and description already attached meant creating each by hand. People have that list as a spreadsheet or a CSV export. A table cannot name nodes, edges and their ends in one block that anyone would write, so the first step is elements only.

## Decision
1. **The existing bulk-create dialog reads a table.** Right-click the Entity or Container button and paste. A paste is a table when its first row has two or more columns, there is at least one more row and no row is wider than the header; otherwise it is a list of labels as before. A selector overrides the guess. Tab-separated text (copied from a spreadsheet) and comma-separated text with RFC 4180 quoting are both read, by a small parser in `src/shared/bulk-create/` with no dependency.
2. **The header decides what a column is, and the person can change it.** `name`, `label`, `title`, `element` or `entity` is the label (without one, the first column is); `description`, `note`, `notes` or `details` the note; `container`, `group`, `domain` or `parent` the container; every other header a tag whose key is the header. A preview shows each column's role in a selector and the first rows. One column per role of label, note and container; a second match is a tag, so no cell is lost.
3. **Wide, not long.** One row is one element and one column one tag key. Rows with the same label merge into one element, so a list of `name, key, value` rows gives the same result. The first non-empty value of a field wins; a later row that says something else is listed as a conflict, because a tag holds one value. A cell with several values stays plain text: a tag has no list.
4. **A non-empty description becomes a note.** It is an unsaved note with no file yet, written with the others at the next Save ([ADR 0092](0092-unified-multi-file-save-and-change-detection.md)), a file per element. The preview says how many. A container has no note in the app, so for a container paste the description column is kept as the tag `description`.
5. **A header that names a required tag, without regard to case, sets that tag and keeps its lock.** A value its `allowedValues` do not list, or any value of a static tag, is left at the template's default and counted in the preview, because the next sync would reset it anyway with a diagnostic ([ADR 0022](0022-unified-tag-and-metadata-system.md)). A required tag with no column gets its default as for any new element.
6. **The container column is carried but not yet applied.** The import's row model has a `container` field from the start. Until the elements are put into containers it is kept as a tag under the header's own name (`Domain=Payments`), so nothing is lost and a highlight can already colour by it. No file-format change: a container, once applied, is stored as `parentId`.
7. **Layout and undo as for the list:** a grid at the centre of the view, one undo step for the whole paste.

## Alternatives considered
- **Wide and long forms as separate modes.** Merging by label gives both from one reading.
- **A description as a tag.** Searchable and file-free, but this tool keeps context in notes; a tag stays the fallback where a note cannot exist.
- **Treating a list of values in one cell as several tags or an array.** A tag is one key with one value and highlights match the exact value; a list would be a data-model change.
- **A mapping dialog after the paste.** The preview is that step, with the guess already made, so the common case is one click.
- **Matching connections in the same paste.** A "depends on" column needs target labels to match and missing targets to create; a separate step over existing elements by label is simpler to understand and works on diagrams already drawn.

## Consequences
- Elements merge on the exact label, so two different things with one name become one; the preview shows "N rows give M elements" before anything is made.
- Undoing the paste leaves its unsaved notes listed among the notes of removed elements until redo or a discard, as for any note typed into an element that is then deleted.
- The table to elements steps are pure code, so a `chd` command or an assistant tool can reuse them; such a writer needs the stale-edit check ([ADR 0109](0109-stale-edit-check-for-every-ai-write-path.md)).
