# 0206: Note file names with a short tail

## Status
Done (not yet confirmed in the app)

## Goal
A note file is named `<label>-<short tail>.md`: the label first, for sorting and for people finding the file, then a few characters that keep two same-label elements apart. The app and an assistant write the same name for the same element, and an assistant never chooses the name of any file except a diagram.

## Tasks
- [x] Decide the tail: the last N hex characters of the element id's UUID (the last UUID group is fully random, so N up to 12 never crosses a hyphen), proposed N = 6. One constant.
- [x] One shared function in `src/shared/notes/notePaths.ts` builds the name; `derivedNotesPath` and the assistant's `noteFileName` (`src/shared/edit/annotations.ts`) both call it.
- [x] An id that does not end in a UUID (assistant ids such as `a-1`) uses the whole id; no first-hyphen slicing.
- [x] An assistant gives a note only the element and the text. Drop `name` from `set_note` (`annotations.ts`, `noteFileName`); the tool derives the file name from the element's label and id.
- [x] An assistant does not choose element ids. `freshId` (`src/shared/edit/model.ts`) accepts a given `id` today, so the tail of a note name could be assistant-chosen. Decide how a batch refers to an element made earlier in the same call without it (design question below), then remove the `id` parameter from the add operations.
- [x] The same in the `chd` CLI and the MCP extension (they share the operations); update the tool descriptions, the bundled skill, `AGENTS.md` and the copy-paste instructions; rebuild the CLI and extension bundles.
- [x] Define what a save does when a note's wanted name is already another note's (error naming both elements, or the next free name); check `documentSave.ts` first.
- [x] Amend [ADR 0060](../../decisions/0060-detail-file-naming-convention.md) in place (it records the full UUID, which was not the intent).
- [x] Tests: app and assistant give the same name for the same element; a short id; a clash.
- [x] Update `docs/file-format.md` and the AI skill references (`resources/ai`, then `npm run sync-ai`) wherever the note name is described.
- [x] CHANGELOG: existing notes are renamed on their next save.

## Notes
- Found 2026-11-23: the assistant path wrote `<label>-<whole id>.md`, so an app-made element got `entity-` in the name, while the app strips the id up to its first hyphen. Same element, two names.
- General principle (maintainer): a person and an assistant can do the same things; they differ only in how (one at a time or in bulk, the format). Only the application writes and changes files. A person or an assistant gives the tool the text and values, and the tool decides names, paths and bytes; neither chooses a file name. Anything the application can handle, it handles. A file made by hand outside the application is the accepted outlier. To audit when this is designed: every assistant operation or tool that takes a `name` or a `path` or writes a file directly (`set_note` `name`, the `id` parameters, `add_new_linked_diagram` `name`, `create_file` / `update_file` on a note), against what a person can do in the app. This epic covers notes; the rest of the audit may deserve its own epic and an ADR.
- Principle for notes (maintainer): the assistant creates an element and gets its id back, then asks for a note with that element and the text; the tool builds the name from the label and the last 6 characters of the id. The assistant can neither name the file nor supply the tail.
- Open design question, narrower than it looks: today a batch can create an element with a chosen `id` and connect to it, note it, tag it and style it in the same call. Without chosen ids only the creation of elements and the edges between them in one call has no way to point at the earlier result. Notes, tags and styles of elements that already exist take the returned ids in a second call (create, then notes/tags/styles in one call, then validate). Options for the one remaining case: a handle that lives only for that call (never saved), or edges in the second call.
- Ids already in saved diagrams that were chosen by an assistant (`a-1`, `p3`) stay valid; an id that does not end in a UUID is used whole in the name, and ids are unique in a diagram, so those names cannot clash.
- Done: the save executor writes and moves note files over whatever is at the target, so two notes with one name would have destroyed one. The names are therefore made for all the notes of a diagram together (`derivedNotesPaths`): a clash makes those notes take 8, then 12 characters, then the whole UUID, then a number. The assistant's `set_note` uses the same function; the first of two clashing notes keeps the name it was written with until the editor's next save renames it.
- Done: ids are the tool's own and an operation names what it makes with a handle that lives for one call ([ADR 0199](../../decisions/0199-the-tool-makes-every-id-and-an-operation-names-what-it-makes-with-a-handle.md)). The same operations run in the command line and the extension. The CLI and extension bundles need rebuilding before a release.
- Nothing reads the id prefix except that strip, so the prefix stays in ids as it is.
- Rejected: a separately stored random tag per note (needs a file-format field for nothing the id does not already give).
- Existing notes need no migration code: the save compares the current name with the wanted one and renames on any difference (ADR 0060).
