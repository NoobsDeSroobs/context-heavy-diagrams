# 0158: Notes: the name for the Markdown files behind an element

## Status
Built, awaiting the maintainer's live check and release as 0.5.0. The word is decided ([ADR 0140](../../decisions/0140-the-markdown-files-behind-an-element-are-called-notes.md)). The interface already said notes in v0.4.0; this adds the stored key, the folder and the code.

## Goal
One word, "notes", from the file on disk to the interface. The key is `data.notes` with `data.details` read as an alias, new notes go in a `notes/` folder, and the code's `details` feature folders follow.

## Tasks
- [x] Decide the word and write the ADR
- [x] Interface, search facet, docs, AI instructions and the extension say notes; the canvas Text element is the textbox (v0.4.0)
- [x] `parseDiagram` reads `details` as `notes` in the one normalising function that already handles the Shape-to-Entity rename; the serializer writes `notes`; recovery snapshots from an older build are normalised on read, including their `detailsDrafts`
- [x] Notes go in `<diagram>/notes/`; a note still in `details/` is moved there on the next save (seen when the `c4-context` example was saved in the new build), and the emptied folder is removed (it was left behind at first); stored paths keep working wherever they are
- [x] The `details` feature folders in `main`, `renderer/src` and `shared`, and the identifiers, IPC channels (`notes:read`, `notes:readWithStamp`) and CSS classes in them, renamed
- [x] The bundled skill (and the repo's copy, via `npm run sync:ai`), its validator and the format spec read and write `notes`; the MCP extension takes its spec from the skill
- [x] `docs/file-format.md`: the field, the alias, the folder
- [x] Tests: a file with `details` opens as `notes`, wins on both keys, and saves with `notes` only; the fixtures use the new key
- [x] The gallery examples are migrated: the key, the folders and the paths; a text key that explained the colours became a legend; epic mentions and unbuilt-work notes removed from the diagrams, notes and READMEs
- [x] Changelog "File format" entry and the version bump to 0.5.0 (an older build drops the link in a file saved by a newer one)
- [ ] Live check in the app: open a gallery diagram, open a note, edit and save; a new note lands in `notes/`; save a diagram that had `details` and read the file; a diagram with notes opened in the compare window
- [ ] Release 0.5.0

## Notes
The word was first used in the interface only. The key and folder were kept to avoid a format change, then renamed after all: two words for one thing in the file and the code would have stayed for good.
