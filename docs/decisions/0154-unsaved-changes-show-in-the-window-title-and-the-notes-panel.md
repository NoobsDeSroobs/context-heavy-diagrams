# 0154: Unsaved changes show in the window title and the Notes panel

## Status
Accepted (2026-11-08).

## Context
An edit to a diagram or to a note goes into memory at once and reaches the files only when the diagram is saved, as one document ([ADR 0092](0092-unified-multi-file-save-and-change-detection.md)). Nothing in the window said so: the unsaved state showed only in the close prompt, the reload confirmations and the Changes panel. A person editing a note could not tell whether closing the panel keeps the text, or whether it was on disk.

## Decision
- **Two states:** unsaved (in memory) and saved (on disk). There is no state between typing and memory, because the editor shows the in-memory copy. The crash-recovery snapshot is not shown.
- **The window title** is `<file name> — Context-Heavy Diagrams`, with a dot in front while the diagram or any of its notes is unsaved, and "Untitled" for a diagram never saved. A title works the same on Windows and Linux and shows in the task bar.
- **The Notes panel** shows a mark beside the note's title: "Unsaved" (with a dot, so it is not told by colour alone) while the note has edits that are not in its file, "Saved" when the file is what the panel shows, and nothing for a note that has no file and no edits yet. The tooltip says edits are kept when the panel is closed and are written when the diagram is saved.
- **Closing the panel does not write the note.** Writing one file apart from the rest would split the document and bring back a separate conflict check for it.

## Alternatives considered
- **Three states (not in memory, in memory, on disk).** The first does not exist.
- **Write the note when the panel closes.** Breaks the one-document save above.
- **Only a chip in the Notes panel.** The same confusion applies to every other edit.
- **macOS's edited-document mark.** Needs a call to the main process for a platform that is not a first-class target; the title dot covers it.

## Consequences
- A window now has the file's name in its title; before, every window was titled with the app's name.
- Any new kind of unsaved edit must go through the existing dirty state to show in the title.
