# 0187: Copy the selection for an assistant

## Status
Not Started. Design agreed in outline 2026-11-10; two choices open (below). Replaces the live connection that was decided against in [ADR 0169](../../decisions/0169-no-live-connection-between-the-mcp-server-and-the-app.md).

## Goal
A person selects some elements and copies them as plain text that tells an assistant (or a colleague, in any text editor) exactly what they mean: the elements, their relationships, tags, colours and fonts, and nothing else. The same text pasted into a Context-Heavy Diagrams window recreates the elements.

## What exists
Ctrl+C already puts the selection on the system clipboard as JSON, and Ctrl+V in any window recreates it with new ids ([ADR 0049](../../decisions/0049-clipboard-copy-paste.md)). It is not suited to an assistant:
- It is React Flow's own node shape, with run-time fields (`selected`, `measured`, `dragging`), not the `.chd` shape that the format spec and the assistant's tools describe.
- It carries notes, linked-diagram and reference paths and custom icon paths, which mean nothing outside the diagram's folder.
- A contained element keeps a position relative to a parent that may not be in the copy.

## Design
- **What goes in:** entities, containers, texts, lines and the edges between the selected elements, with id, type, position, size, label, style (colours, fonts, borders), tags (metadata) and, for edges, label, style, bend points, attachment points. **Left out:** notes, links, references, custom icon files, the security matrix. Built-in icon names stay.
- **Shape:** the `.chd` file shape of a node and an edge (`toDiagramFile` already produces it), inside the existing envelope (`chdClipboard`, a new `version`). An assistant that has read the format spec can read it; paste reads it back with `fromDiagramFile` and the existing id remapping, and keeps reading the old payload.
- **A contained element whose container is not selected** is written at its absolute position without `parentId`, so the numbers mean what they say.
- **Where:** an Edit menu entry and a command-palette entry, **Copy for an assistant**. No shortcut: Ctrl+Shift+C is taken by copying a style.

## Open choices
1. **A new entry, or change Ctrl+C itself.** Recommended: a new entry. Ctrl+C is what people use to duplicate between diagrams, and dropping their links and notes there would be a surprise; a note copied by reference is shared with the original, which is a known limitation of the current copy.
2. **Paste back from an assistant.** A reply with changed elements pastes as new copies, not edits to the originals. Accepted for now: the copy is for telling the assistant what to change, and the assistant's own tools make the change.

## Tasks
- [ ] Decide the two choices above
- [ ] Pure `buildSurfaceCopy` (selection to payload) and the paste reader for the new version, with tests, including a contained element whose container is not selected
- [ ] Edit menu and command palette entry; shortcuts help
- [ ] Example text in `docs` or `examples/` that shows what an assistant receives; `docs/file-format.md` or the AI documentation names the clipboard form
- [ ] Try it: copy, paste into a text editor, paste into another window; give it to an assistant and ask for a change

## Related
[ADR 0049](../../decisions/0049-clipboard-copy-paste.md), [ADR 0169](../../decisions/0169-no-live-connection-between-the-mcp-server-and-the-app.md).
