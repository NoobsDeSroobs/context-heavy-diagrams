# 0185: Show unsaved changes

## Status
Built (2026-11-08), awaiting a look in the app. Logged 2026-11-08. ADR: [0154](../../decisions/0154-unsaved-changes-show-in-the-window-title-and-the-notes-panel.md).

## Goal
Nothing in the window says that the diagram, or a note being edited, has changes that are not on disk. The unsaved state only shows in the close prompt, the reload confirmations and the Changes panel. A person editing a note cannot tell whether closing the panel keeps the text, or whether it is on disk yet.

## Decided
- **Two states, not three.** An edit goes into an in-memory copy at once (closing the panel keeps it), and reaches the file only when the diagram is saved, as one document ([ADR 0092](../../decisions/0092-unified-multi-file-save-and-change-detection.md)). So: unsaved, or saved.
- **A marker for the whole diagram,** in the window title, since it helps every kind of edit and works the same on Windows and Linux.
- **A chip in the Notes panel toolbar** beside the note's title: "Unsaved: saved with the diagram (Ctrl+S)" while that note has edits, a quiet "Saved" otherwise.
- **Closing the Notes panel does not write the note.** That would split the document and bring back a per-file conflict check.
- The crash-recovery snapshot (every 5 seconds while unsaved) stays invisible.

## Tasks
- [x] The window title: file name, a dot while unsaved (the macOS edited-document mark is left out)
- [x] The Notes panel mark, from the note's own dirty flag
- [x] A short ADR: the two states and where they show
- [x] Tests for the title text and the mark
- [ ] Look at it in the app on Windows and Linux, in both themes
