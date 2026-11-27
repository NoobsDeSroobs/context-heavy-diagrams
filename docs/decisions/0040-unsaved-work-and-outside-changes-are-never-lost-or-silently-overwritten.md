# 0040: The person's unsaved work and the files on disk are never lost or silently overwritten

## Status
Accepted. Merges 0040 (dirty tracking, close prompt, autosave), 0091 (detecting outside changes), 0092 (one save over a diagram and its notes), 0128 (what opening changes counts as a change) and 0159 (one notice for every changed file) into one decision, reworded 2026-11-26. It keeps the lowest number of the group.

## Context
A diagram and the notes it owns are plain files, edited by the app and just as often outside it: the person's own editor, `git checkout`, an assistant writing a `.chd` against the file-format spec. A window holds its own in-memory copy of each file, so work can be lost three ways: closing or crashing with unsaved edits, saving a stale copy over a file that changed on disk, and an in-memory diagram that differs from its file without anyone knowing.

## Decision
**The person's work is never lost, and never silently overwritten in either direction. Git is the merge tool; the app only refuses to hide a conflict.** There is no merge UI and no three-way logic.

- **Unsaved work is tracked, per file.** The diagram (the hub) and each note it owns (a shadow, held only while open or edited) have their own dirty flag, set at the edit site by an explicit `markDirty()`, not derived from undo history, which covers only part of what a diagram is. Session-only state (which panel is open, which highlights are switched on) never counts. Editing a note alone does not dirty the diagram.
- **Closing with anything dirty asks to Save, Discard or Cancel.** Autosave writes a recovery snapshot to the app's data folder (not a file beside the diagram, which would clutter the project and risk a commit) every few seconds while something is dirty and has changed. A snapshot is offered back only when it is newer than the file, with Recover or Discard, so it can never silently replace an edit made outside the app. A diagram that crashed before its first save is found by a scan at startup, which can be switched off. A snapshot is deleted once its edits are saved or discarded.
- **What opening a diagram changes counts as a change.** Opening can repair a diagram (a dangling container reference dropped, a required tag added, a stale reference pruned, a highlight group resynced). After a load the canvas compares what a save would write with what was read, and if they differ the diagram is dirty. One comparison covers every kind of repair, present and future. It ignores what a save stamps or defaults (`savedWith`, an omitted `zIndex`). The repairs stay silent apart from Diagnostics notes, and the example diagrams are kept in the state a save leaves them in, which a test checks.
- **Outside changes are detected one way for every file.** A cheap fingerprint (modified time and size) is recorded whenever this window reads or writes a file, and compared on window focus, when a note opens, and before every save. There is no file watcher: it behaves differently on each OS and under editors that save by rename, and checking on focus is when an outside edit is noticed anyway. One notice lists the changed files and which of them have unsaved edits here, with Review changes (for the diagram), Reload and Ignore. Reload touches only the listed files, keeps unsaved note edits on a diagram reload, and asks before discarding any. Ignore remembers that change per file; the save-time check never reads it.
- **Saving writes only what is dirty and resolves conflicts per file.** Files that did not change on disk are written without a question. Files that are dirty and also changed on disk are listed in one dialog with Keep mine or Take disk for each, or Cancel, which writes nothing. The order is crash-safe: new and changed files first, then the diagram pointing at them, then deletion of old paths, so a crash leaves a diagram that points at files that exist. A renamed note is moved from its original path, derived at save time from its label and never stored. After Take disk on the diagram, edits for an element the reloaded diagram no longer has are kept and listed in Diagnostics, never dropped.

## Alternatives considered
- **Dirty state derived from undo history.** It cannot cover metadata, highlights, the legend or note drafts, which live outside it.
- **A full content comparison against the last save.** Needs value comparison and throttling while dragging, for a case (reverting by hand to the saved state) that is rare.
- **A file watcher.** See above.
- **A content hash instead of time and size.** Not needed so far; revisit if a filesystem's time resolution proves unreliable.
- **Silently preferring the newer of file and recovery snapshot,** and **repairing silently without marking the diagram changed.** Both can lose an edit without a word.
- **A flag per kind of repair.** Every new repair would have to remember it.
- **One choice for the whole conflicting set, or an in-app merge.** Throws away work in the files that did not conflict; git already merges.

## Consequences
- Dirty tracking is explicit, not automatic: any new state that is saved must call `markDirty()` where it changes.
- A note that changes on disk while its panel is open raises the notice instead of refreshing silently, so every file behaves the same way.
- A hand- or assistant-written diagram that lacks a required tag asks to save once after it is opened, then no more.
- Behaviour that depends on the OS (time resolution, dialog wording) can only be checked on that OS.
