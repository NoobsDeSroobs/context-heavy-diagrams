# 0092: A hub and its shadows — unified multi-file save and change detection

## Status
Decided design, revised 2026-09-20 after the shadow-model discussion; the two points left
open in the first revision are now settled (per-file conflict resolution; rename path derived
at save with the original path kept). **Step 1 implemented 2026-09-20** (core + Save migration — see "Implementation notes"
at the end); the follow-up (notices, minimal reload, hub-reload reconcile, per-file dialog)
is not. Tracked in
[epic 0129](../planning/epics/0129-unified-multi-file-save-and-change-tracking.md).
Supersedes the *structure* of [ADR 0091](0091-external-change-detection.md) (its behaviour and
"git is the merge tool" stance stand; its split baselines and per-kind logic do not).

## Context

ADR 0091 bolted change detection onto the existing save flow: the diagram's baseline lives
in the main process, each note's in the renderer, with separate focus checks, notices and
two conflict popups that can fire on one Save. Writing happens in type-specific steps, and
some files (icons, reference images, new child diagrams) are written at pick time while
others (notes, renames, staged removals) at save. Worse, reloading the diagram file wipes
*every* unsaved note draft, because notes and diagram share one all-or-nothing reset.

The user's principle: **to the user everything is part of the same diagram — every kind of
edit and every kind of file produces identical popups and behaviour.** The user's mental
model for achieving it is a digital-twin one: real devices and a real server, above which
sits a digital layer of a hub and independent *shadow* devices; operations target one shadow
and conflicts are per real-file/shadow pair.

## Decision

**1. Model: one hub, independent shadows.**
- The **hub** is the diagram file; its shadow is the live canvas state (nodes, edges, …).
- A **shadow** is the in-memory representation of one *owned* file (today: a detail note).
  Shadows live in a **shadow registry, decoupled from the diagram data model**. Each entry holds:
  the element's stable **nodeId** (its key), the **original path** (the real file we last
  read/wrote), the last-seen **baseline stamp**, a **dirty flag**, the note's **content only
  while it is dirty or open**, and an **ignored stamp** (see 5).
- Every operation — reload, conflict check, save — targets individual entries. Conflicts
  are always between one real file and its own shadow. Reloading the hub replaces only the
  hub's state; the shadow registry is untouched.
- **Document scope:** the hub plus the files it owns. A link is a field in the diagram file;
  the file it points to is a separate document (its own window). Files that are merely
  *added* (custom icons, reference images, a new child diagram) stay **written immediately**
  — adding can't conflict and is easily discarded through git. Removals stay staged until save
  ([ADR 0084](0084-diagnostics-missing-files.md)).

**2. Two independent triggers, one shared detector.**
- **On save** — one top-level `saveDocument()` owns the macro flow and hides ordering: plan
  → check the files it is about to *write* → one popup if any changed on disk → otherwise
  just save → record new baselines.
- **On window focus / panel open** — the same check over the tracked entries → one
  **notice** with **Reload / Ignore**, identical for every file kind.
- The triggers never depend on each other but call **one shared detector**
  (`findChangedFiles`) over **one shadow registry**, so exactly one place knows how to
  tell whether a file changed on disk.

**3. Dirty is a per-entry flag, used as a candidate filter.** Set at the edit site (one
place per kind); checking N entries is checking N booleans. Where an unneeded prompt is
possible (flag set but text may equal what's on disk), the flag only nominates candidates
and the content is compared **for those alone**. The hub has **its own** flag: editing a
note does *not* dirty the hub unless the edit changes what the hub says (creating a note,
moving one). "Anything dirty" (close prompt, autosave) is simply any flag being set — this
replaces the single `isDirty` boolean of [ADR 0040](0040-dirty-tracking-and-autosave-design.md).
No prompt on closing a panel with unsaved edits: dirty content stays in memory until save,
so several notes can be edited across panels and saved in one update.

**4. Save writes only what is dirty, and resolves per file — like git.** Non-overlapping
work needs no attention: dirty files that did not change on disk are written silently. The
**popup appears only for dirty files that also changed on disk** and lists them all at
once, with **a choice per file**: *Keep mine* (overwrite the disk version) or *Take disk*
(drop my edits to that file and reload it), plus shortcuts to set all at once, and **Cancel**
(the default; go to git, nothing is written). Per-file resolution is required from the
start, not a later refinement (the user: "quite important"): with several overlapping
files a single blanket choice throws work away. The native message box cannot present a
per-file choice, so this is an **in-app dialog** (same shell as the alert dialog, with
selectable text). After the choices, "Take disk" files are reloaded and everything else is
saved without further prompts. If the **hub** was among the "Take disk" files the save stops
after reloading it (the plan was built from state that just changed) and the user re-saves.
A clean file that changed on disk is a notice matter, not a save conflict.

**5. Reload is minimal, and the hub can be reloaded alone.** The notice lists the changed
files, marks any with unsaved in-app edits, and **Reload** acts on those files only (the hub,
note 44, or both). A Reload that would discard unsaved edits asks first. **Ignore** remembers
the specific change per file so re-focusing doesn't re-nag; the save popup still fires.
After a **hub reload**, the shadow registry is reconciled: an entry whose nodeId still exists is
kept exactly as it was (dirty ones keep their edits); a *clean* entry whose element has
gone is dropped; a **dirty** entry whose element has gone is **kept as an orphan and
surfaced** (Diagnostics), never silently discarded. Because entries keep their original
path, a later "relink orphaned edits by path" repair is possible; that UI is **out of scope**
for the first implementation.

**6. Moving files is a save-only concern.** The in-memory node keeps pointing at the file's
*original* path until Save performs the move. The *desired* path is **derived at save time**
from the label and nodeId (a pure function, as today) and never stored, so undo/redo and
label editing can never leave stale state. The shadow therefore keeps exactly one path, the
**original** — the real file's identity. Everything that touches the real file uses it: opening
the note after a label change, reloading it to pick up outside edits, the change check, and
the move itself (original → derived, if they differ). After a successful save the original
path becomes the new one. An unedited note being renamed is **moved as its on-disk content**,
never re-written from possibly-stale memory.

**7. Write order (crash-safe) and failure.** Additive first, pointer switch, destructive
last: write new/changed files → write the hub (now pointing at the new paths, only if it is
dirty or its references changed) → delete old paths. A crash at any point leaves the on-disk
hub pointing at files that exist. No rollback: files already written get new baselines and
clear their flags, the rest stay dirty, and the user is told which succeeded.

**8. Memory hygiene.** Content is held only for dirty or currently-open notes; an unedited
note's copy is dropped when its panel closes, so a clean note is always read fresh and
nothing stale can be flushed over an outside edit.

## Alternatives considered
- **A four-state machine per file** driving both triggers. Rejected: each trigger needs only
  its own question.
- **Track every referenced note.** Rejected: only in-memory copies can go stale.
- **Diff-by-content for every file on every check.** Rejected in favour of the dirty flag as
  candidate filter.
- **Store the desired (renamed) path in the shadow when the label changes.** Rejected: needs
  syncing with undo and mid-typing label edits; deriving it at save from the label loses nothing
  because the original path is kept.
- **One choice for the whole conflicting set (native message box).** Rejected by the user:
  per-file resolution is required from the start.
- **Stage asset creation until save.** Rejected: real complexity for a harm git covers.
- **One whole-document Reload / a file watcher / in-app merge.** Rejected.

## Consequences
- ADR 0091's diagram-side `diskBaselines` (main) and note-side `detailsBaselineRef`
  (renderer) become one shadow registry; its two focus effects and two popups become one each.
- A new in-app **conflict dialog** (per-file Keep mine / Take disk, set-all shortcuts, Cancel)
  replaces the native save-conflict message box from ADR 0091. The close-prompt stays native.
- Per-entry dirty flags replace the global `isDirty`; autosave/recovery snapshots the dirty
  entries. Editing only a note no longer rewrites the `.chd`.
- The save planner (desired state → writes/moves) is a pure function so it can be tested
  without a real filesystem; the executor stays thin.
- Touches `persistDiagram`, `flushDetailsDrafts`, both focus effects, `DetailsPanel`, diagram
  reload, and the dirty-tracking call sites.
- An unedited open note that changes on disk raises a notice instead of refreshing
  silently — deliberate, for uniformity.

## Implementation notes — step 1 (core + Save migration)
What landed, and where it settled the questions this ADR left open:

- **The shadow registry lives in the renderer; main is stateless.** Main can't hold the
  per-note content/dirty state anyway, so baselines travel with the data: `diagram:openPath`
  and `details:readWithStamp` return the stamp with the content, `document:save` returns the
  new stamps, and the renderer keeps them. `files:check` is the one shared detector.
  (Replaces ADR 0091's main-side `diskBaselines` and renderer-side `detailsBaselineRef`.)
- **Pure core** — `src/shared/documentSave.ts` (shadow model + `planSave`, no runtime
  imports), `src/shared/detailPaths.ts` (`derivedDetailsPath`), and the executor
  `src/main/documentSaveExec.ts` (verify → new/changed files → diagram → old paths;
  dependencies injected). 25 unit tests run with `npm test` (Node's built-in runner, no new
  dependency), the executor against a real temp directory.
- **Dirty flag** is exact and per note: `editNote` sets `dirty = content !== baselineContent`
  at the single edit site (one string compare, on the note being typed). `isDirty` for the close
  prompt/autosave is `hubDirty || anyNoteDirty`. Editing a note alone no longer dirties or
  rewrites the `.chd`.
- **Save** = `persistDiagram` in `Canvas.tsx`: build the plan, one `document:save`. **Everything
  that does not conflict is saved first; conflicts are handled at the end** (a first live test
  showed the initial all-or-nothing version blocked the diagram because one note conflicted —
  contradicting the "non-overlapping work needs no attention" principle above). Main holds back
  only the conflicting files and returns what remains; the renderer then shows **one interim
  native popup listing them (Cancel / Overwrite)** and, on Overwrite, sends a second request for
  just those. Cancel leaves them dirty. Dependencies are respected: if the *diagram* is held back,
  note creates/renames are held too (it cannot reference them, and a rename would delete the
  name it still uses); if a *note* is held back while being renamed, the diagram is saved
  keeping its old path. The per-file dialog is the next PR.
- **Deviations from the text above, all deliberate for this step:** focus/open notices and the
  Reload button are unchanged in behaviour (only re-based on `files:check`); a diagram reload
  still resets every note shadow (minimal reload + reconcile is the next PR); a clean note's
  in-memory copy is dropped when its panel is closed with ✕ — other ways the panel closes leave
  it cached, which is harmless because clean shadows are never written and the open-time check
  refreshes a stale one; on Save, shadows whose element no longer exists are dropped (their
  unsaved text is discarded — before this change it was written to an orphan file; the
  reconcile PR surfaces such edits instead).
- Save As / first save writes only *dirty* notes to the new location — unchanged limitation:
  notes that weren't opened aren't copied to the new folder.

## Implementation notes — step 2a (per-file conflict dialog)
- **In-app dialog replaces the interim native popup.** `ConflictDialog` (mounted by Canvas,
  opened through the promise-based `askConflictResolution`, same pattern as the alert dialog)
  lists every file that was held back, one row each, with **Keep mine** / **Take disk**. Nothing
  is preselected, "Apply" stays disabled until every row is answered, there are "…for all"
  shortcuts, Cancel/Escape leaves everything unsaved. Text is selectable.
- **The decision logic is a pure, unit-tested function** — `resolveConflicts` in
  `src/shared/documentSave.ts`: turns the choices into the finishing request. Keep mine =
  re-send the write with overwrite; Take disk for a note = adopt the file into its shadow (my
  text is never recorded as saved), and if that note was also being renamed the disk content is
  *moved* to the new name; Keep mine for the diagram also releases creates/renames that were
  held only because the diagram was held; **Take disk for the diagram** = reload it and stop
  (only in-place note writes chosen "mine" still go through, since anything planned against the
  old diagram is off — the rest stays dirty and is re-planned on the next Save).
- **A diagram reload now keeps unsaved note edits** (`loadDiagramIntoCanvas` with
  `keepNoteShadows`; used by "Take disk" and by the toolbar Reload). Clean note copies are just a
  cache and are re-read on demand. Edits for an element the reloaded diagram no longer contains
  cannot be shown, so an alert says they were discarded — surfacing them in Diagnostics is still
  to do. The Reload confirm now only warns about the diagram's own edits.
- **The snapshot written before asking is deleted once the choices are applied**, so recovery
  never offers edits that were just saved or discarded.
- **Still open for step 2:** one notice for every file (Reload / Ignore) on window focus, with
  minimal reload of only the changed files; orphaned dirty edits in Diagnostics.
