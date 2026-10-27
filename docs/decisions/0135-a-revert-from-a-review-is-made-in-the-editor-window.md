# 0135: A revert from a review is made in the editor window

## Status
Accepted (2026-10-27)
Supersedes: none
Superseded by: none

## Context
A reviewer who finds a change they do not want should be able to undo that one change, not restore the whole file. The compare window never changes a diagram ([ADR 0132](0132-the-compare-window-is-a-read-only-canvas-with-its-own-bridge.md)), and the editor window already has an undo history, a saved file it tracks and a conflict check.

## Decision
**One whole element at a time, put back as the earlier version has it, through the editor's normal edit path.** The rows say **Revert** (modified), **Restore** (removed) and **Remove** (added). The same actions exist on each row of the changes-since-last-save panel ([ADR 0102](0102-changes-since-last-save-scope.md)), where the earlier version is the saved file (read again at click time). Both call `putElementBack` (`resetElement.ts`), so a revert is one undoable edit and Ctrl+Z puts it back.

**From the compare window the request goes through the main process.** The window asks; the main process checks the kind and change, finds the editor window for the same file through the window registry and forwards the earlier version and the element; the editor does it and answers. No editor window for the file, a diagram that was never saved, or no answer within 10 s each give a sentence under the row. The compare window writes nothing itself. A revert also ticks the change off.

**Rules for what goes back with an element:**
- Restoring a node also restores the connections it lost whose other end exists; a connection whose end node is gone says which node to restore first.
- A node whose earlier container is gone, or would now enclose it, goes top level where it was drawn.
- An added container's contents stay.
- A note's text is a file, not part of the element: it is not restored, and the row says so.

The compare window works whether or not the editor has reloaded the outside edit, but its hint tells the reviewer to reload first, since reverting an outside edit only makes sense once the editor holds it.

## Alternatives considered
- **The compare window edits the file.** It would break "never writes", race the editor's own autosave and state, and bypass its undo.
- **Revert a whole version, or a field at a time.** A whole file is what git already does; a field at a time is more buttons than a review needs. An element is the unit the list shows.
- **A toggle to restore a removed element without its connections.** Not built; a small addition if someone wants it.

## Consequences
- A revert needs the diagram open in an editor window. That is the price of keeping the compare window read-only.
- A note's text cannot be reverted from a review; git is the way back for it.
