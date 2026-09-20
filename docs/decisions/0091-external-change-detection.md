# 0091: Detecting and surviving changes made outside the app

## Status
Decided and implemented (2026-09-19). **Structure superseded by [ADR 0092](0092-unified-multi-file-save-and-change-detection.md)** (2026-09-20): the behaviour described below (focus notice, save-time popup, "git is the merge tool") stands, but the split main-side/renderer-side baselines, the two popups and `flushDetailsDrafts` were replaced by one shadow registry, one detector (`files:check`) and one save plan (`document:save`).

## Context

Diagrams and their detail notes are plain files, edited outside the app all the time: the user's own editor for the `.md` notes, `git checkout`/pull, and Claude (or other tooling) editing a `.chd` directly against the file-format spec. A window holds its own in-memory copy, so two silent-loss paths existed:

1. Saving a stale diagram over a file changed on disk.
2. Saving a **detail draft** over a note changed on disk. Worse than it sounds: opening the Details panel seeds a draft from the file, and `flushDetailsDrafts` rewrites *every* draft on each save — including ones the user never edited — so merely having looked at a note was enough to clobber a later outside edit.

## Decision

**Git is the merge tool; the app only refuses to hide a conflict.** No merge UI, no three-way logic.

- **Detection is a cheap fingerprint compare, not a watcher.** Main records `mtime:size` (`fileStamp.ts`) when a window loads a diagram (`diagram:openPath`) or saves it (`diagram:save`), keyed by the window's `webContents` id + path. It is compared against a *recorded* stamp, never the wall clock. On load the stamp is taken **before** reading, so a change in between produces a spurious "changed" (a harmless extra prompt) rather than a missed one.
- **Checked at two moments:** window focus (toolbar banner) and immediately before any save (`persistDiagram`, the single write path — so manual save, the close-prompt's Save, Save & Open Here, and the three link flows are all covered), *before* detail drafts are flushed.
- **Not dirty + changed on disk (focus):** an amber toolbar notice with **Reload** / **Ignore**. Ignore remembers that specific stamp so re-focusing doesn't re-nag, but never touches the baseline — the save-time check still fires.
- **Conflict at save (diagram file):** a native message box (same mechanism as the close prompt) — *Cancel* (default; go to git), *Overwrite with editor version*, *Reload from disk*. Copy differs depending on whether the editor has unsaved changes. Cancel/Reload abort the save via `SaveAbortedError` (swallowed by callers — not a "Save failed").
- **Detail notes:** each draft records the note's stamp + content when read (`detailsBaselineRef`). At flush: a changed-on-disk note with an **unedited** draft is not written — the outside change wins and the draft is refreshed from disk; an **edited** draft raises the same popup (listing the affected elements).
- **Open Details panel (added after first live test):** the save-time check alone left the panel showing a stale cached draft — closing and reopening it re-uses the draft and never re-reads the file. So the panel also checks when it opens and on window focus: an **unedited** draft is silently re-read from disk with a toolbar notice (same place as the diagram-file one, naming the note) saying it was updated from disk; an **edited** one shows a toolbar notice "changed outside the app, and you have unsaved edits" with *Reload (discard mine)* / *Keep mine* (Keep mine remembers that stamp; the save-time popup still guards the overwrite). Notes whose panel isn't open are still only checked at save.
- **Baseline-less cases aren't checked:** never-saved diagrams, a Save As to a different path (the OS save dialog already confirmed that overwrite), a file that no longer exists (a save simply recreates it), new notes with no file yet, and drafts restored from a crash-recovery snapshot.

## Alternatives considered
- **`fs.watch` / a real file watcher.** Rejected: differs between Windows and Linux, breaks under editors that save via rename, and the focus check covers the real workflow (edit elsewhere, switch back).
- **Content hash instead of mtime+size.** Not needed so far; revisit if mtime granularity proves unreliable on some filesystem (flag for Linux verification).
- **Baseline held in the renderer.** Rejected: main performs both the read and the write, so it can stamp at the moment of each without a second round trip or a race.
- **Auto-merge / in-app diff.** Rejected by design — git already does this and the user chose it as the merge tool.

## Consequences
- Autosave/crash recovery ([ADR 0040](0040-dirty-tracking-and-autosave-design.md)) writes only to `userData/recovery/`, never the real file, so it can't trip or bypass this check.
- A "Reload from disk" chosen at the conflict popup replaces the editor content without a second confirm (the user just chose it).
- `createAndLink` creates the child `.chd` *before* saving the parent; backing out of the conflict popup there leaves that new child file on disk unlinked. Rare; accepted.
- Reference images and custom icons aren't covered (Chromium/data-URL caching would need separate handling) — not in scope.
- Only verifiable end-to-end in the real app; Linux behaviour (timestamp granularity, dialog wording) must be checked there.
