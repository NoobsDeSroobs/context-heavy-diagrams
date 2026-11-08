# 0159: One notice for every file that changed outside the app

## Status
Accepted (2026-11-08). Completes the notice and the reload described in [ADR 0092](0092-unified-multi-file-save-and-change-detection.md), which it supersedes where they differ (the open note no longer refreshes silently).

## Context
A diagram and the notes it owns are separate files. An outside edit (another editor, git, an assistant) to either reached the person through two mechanisms: a toolbar banner for the diagram file, and a separate notice for the one note whose panel was open. The first offered Review, Reload and Ignore; the second refreshed an unedited note silently and, for an edited one, offered Reload (discard mine) and Keep mine. A note that was not open was not watched at all, and the diagram's Reload did not touch notes.

## Decision
1. **One detector over every tracked file.** The tracked files are the diagram and each note this window holds a copy of: open, or with unsaved edits. On window focus, and when a note panel opens, one check (a stat per file) tells which changed since this window last read or wrote them.
2. **One notice** lists the files that changed, and says which of them have unsaved edits here: `Changed outside the app: shop.chd, Note "Payments". You have unsaved edits to Note "Payments".` Buttons: **Review changes** (only when the diagram itself changed), **Reload**, **Ignore**.
3. **Reload is minimal.** It reloads the files in the notice and nothing else: the diagram, a note, or both. A diagram reload keeps unsaved edits to notes, as before. When a reload would discard unsaved edits it asks first and names the files.
4. **Ignore remembers the change, per file,** by its stamp: the same change is not announced again on the next focus, a later change to the file is. The save-time check never reads it, so an overwrite is still caught when saving.
5. **An unedited open note that changed raises the notice too,** instead of being refreshed silently, so every file behaves the same way.
6. **Saving the diagram clears the notice,** since the baselines it names were just replaced; a file still unresolved is announced again at the next focus.

## Alternatives considered
- **Keep the two mechanisms and share the wording.** Leaves a note that is not open unwatched and two reload actions that disagree.
- **A file watcher.** More moving parts and permissions; a stat on focus is when an outside edit is noticed anyway ([ADR 0091](0091-external-change-detection.md)).
- **Reload everything on one button.** Throws away unsaved edits to files that did not change.

## Consequences
- A note that changes on disk while its panel is open no longer updates by itself; the person chooses Reload.
- The check covers a note only while it is open or edited; a closed, clean note is read fresh when opened.
