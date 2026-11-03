# 0158: Notes: the name for the Markdown files behind an element

## Status
In Progress. The word is decided ([ADR 0140](../../decisions/0140-the-markdown-files-behind-an-element-are-called-notes.md)). The interface, docs, AI material and search already say notes (v0.4.0, with the `details` key unchanged). Left: the stored key, the folder and the code.

## Goal
One word, "notes", from the file on disk to the interface. The key becomes `data.notes` with `data.details` read as an alias, new notes go in a `notes/` folder, and the code's `details` feature folders follow.

## Tasks
- [x] Decide the word and write the ADR
- [x] Interface, search facet, docs, AI instructions and the extension say notes; the canvas Text element is the textbox (v0.4.0)
- [ ] `src/shared` schema: `data.notes`, the reader accepts `data.details`, the writer writes `notes`; one place for the alias so no other code knows both
- [ ] New notes go in `<diagram>/notes/`; paths already stored stay valid; check the colocated-folder move and copy code, Diagnostics (missing files) and the compare window
- [ ] Rename the `details` feature folders in `main`, `renderer/src` and `shared` to `notes`
- [ ] The CLI (`chd validate`, `check`, `diff`, `export`), the MCP server, the bundled skill and `AGENTS.md` read and write `notes`
- [ ] `docs/file-format.md`: the field, the alias and the folder
- [ ] The examples: leave as they are (they exercise the alias) or rewrite them; decide
- [ ] Tests: old file with `details` opens and saves as `notes`; a file with both keys; the stale-edit check hash is unaffected
- [ ] Changelog "File format" entry and a MINOR version bump (0.5.0)
- [ ] Tell users with older builds in the release notes: they drop the link in a file saved by a newer build

## Notes
The word was first used in the interface only. The key and folder were kept to avoid a format change, then renamed after all: two words for one thing in the file and the code would have stayed for good.
