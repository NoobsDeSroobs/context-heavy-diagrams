# 0129: Unified multi-file save and change tracking

## Status
**Done as of 2026-09-20 apart from follow-ups that were deliberately split off into [epic 0130](../later/0130-multi-file-save-follow-ups.md) (technical debt, later):** the unified change notice with minimal reload, orphaned edits in Diagnostics, and a few loose ends. Move this file to `completed/` once the PR (step 1 and step 2a together) is merged.

Design agreed 2026-09-19 — see [ADR 0092](../../../decisions/0092-unified-multi-file-save-and-change-detection.md). **Step 1 (core + Save migration) implemented and live-tested on Windows 2026-09-20** (checklist passed after two fixes it surfaced: partial save on conflict, and crash recovery); `typecheck`/`lint`/`build` clean, 30 unit tests. **Linux not yet verified.** Step 2 (notices on the registry, minimal reload, hub-reload reconcile, per-file conflict dialog) is next. See the ADR's "Implementation notes".

## The observation
The user's hunch: saving is a set of parallel, type-specific functions
(`save_diagram()`, `save_details()`, …) each with its own change-checking, when it
should be one flow — *find every file with unsaved changes, check each against disk in
one place, save each* — so a change to a link, a detail note, or the diagram itself all
go through the same logic.

## What the code actually does today (verified 2026-09-19)
- `persistDiagram` (`Canvas.tsx`) is one function but a **sequence of type-specific
  steps**: diagram-file conflict guard → `flushDetailsDrafts` (which itself mixes
  detail conflict checks, writes, and label-driven renames, and sets React state) →
  apply staged missing-file removals → `toDiagramFile` → `saveDiagram` IPC → state resets.
- **Two parallel implementations of one idea** ("baseline stamp + compare + conflict
  choice"): the diagram's baseline lives in **main**, keyed by window
  (`diagram.ts` `diskBaselines`); each detail note's baseline (stamp + content) lives in
  the **renderer** (`detailsBaselineRef`). Two focus-time effects (toolbar banner for
  the diagram, panel/toolbar notice for the open note), two conflict popups that can fire
  back-to-back on one Save. This duplication is 0128's own doing — it was bolted onto the
  existing structure rather than generalising it.
- **Inconsistent write timing.** Details, renames and staged file-removals
  ([ADR 0084](../../../decisions/0084-diagnostics-missing-files.md)-era) happen **at save**;
  custom icons (`icons:pickAndCopyCustom`), reference images (`references:pickAndCopy`)
  and a new linked diagram (`links:createNew`) are written to disk **immediately** at
  pick time. Nothing states the rule for which is which.
- Per-file dirtiness doesn't exist: one `isDirty` boolean for everything
  ([ADR 0040](../../../decisions/0040-dirty-tracking-and-autosave-design.md)); a note's
  "dirty" is only derivable (`draft !== baseline.content`).

## Assessment: the hunch is right — with three refinements
1. **It's not a flat loop.** The diagram file stores paths that depend on the other files
   (`data.details`, renamed by label; `linkedDiagram`), so notes must be resolved
   (path decided, rename applied) **before** the diagram is serialised. The shape that
   fits is **plan, then execute**, not `for f in dirty: save(f)`.
2. **Check everything first, then write.** One verification pass over *all* affected
   files, **one** popup listing every conflict, then write. Not check-and-write per file
   (which is what causes two popups and half-applied saves today).
3. **Multi-file writes aren't transactional.** Partial failure needs an explicit policy
   (order: notes/renames first, diagram last; write-temp-then-rename per file; what the
   user is told if step N of M fails).

## Agreed design (summary — the ADR is the source of truth; revised 2026-09-20 with the hub/shadow model)
- One **document** = the diagram file + the files it owns (notes). A link is a diagram field; the linked file is a separate document. Added files (icons, references, new child diagram) stay written immediately; removals stay staged.
- **Two independent triggers, one shared detector** over one shadow registry: **save** (top-level `saveDocument()`: plan → check files it will write → one popup → apply → rebaseline) and **focus/panel-open** (one notice, **Reload / Ignore**, identical for every file kind).
- **Reload is minimal** — only files that changed; unsaved edits to *other* notes survive a diagram reload; discarding edits asks first.
- **Tracked set:** the diagram + notes that are dirty or currently open; **drop an unedited note's cached draft when its panel closes** so nothing stale can exist in memory.
- **Renames happen only in save**; an unedited-but-renamed note is moved as its on-disk content. **Write order:** new/changed files → diagram → delete old paths. No rollback; report what succeeded.

## Open for the implementation phase
- Shadow registry/detector wholly in main? How the native popup lists many files. Test setup for the pure planner.

## Explicitly not in scope
No `fs.watch`/file watcher, no in-app merge (git remains the merge tool) — settled in [ADR 0091](../../../decisions/0091-external-change-detection.md).

## Tasks
### Step 1 — core + Save migration (this PR)
- [x] Design conversation → [ADR 0092](../../../decisions/0092-unified-multi-file-save-and-change-detection.md)
- [x] Per-entry dirty flags (hub + each note) replacing the single `isDirty`; editing only a note no longer dirties/rewrites the hub
- [x] Shadow registry in the renderer (nodeId key, original path, baseline, dirty, content) + one shared detector (`files:check`); replaces `diskBaselines` + `detailsBaselineRef`
- [x] Pure save planner (`planSave`) + executor (`documentSaveExec`) + tests (`npm test`, 25 cases)
- [x] `persistDiagram` migrated: plan → one `document:save` → one interim popup listing every conflict; `flushDetailsDrafts`, `details:write/syncName/stat`, `diagram:save/checkExternalChange/confirmExternalChange` removed
- [x] Clean note's copy dropped on panel ✕ close
- [x] Fix from first live test: a note conflict no longer blocks the diagram — save everything possible, ask about conflicts at the end (executor + 4 new tests)
- [x] Fix from live test (recovery): snapshot every 5 s when changed; snapshot written before the conflict popup; snapshots carry note baselines
- [x] Live test on Windows (user)
- [ ] Verify on Linux (timestamp granularity, dialog wording, recovery folder)

### Step 2 — next PR
- [x] In-app conflict dialog: per-file Keep mine / Take disk, set-all shortcuts, Cancel (replaces the interim native popup); hub "Take disk" stops the save after reload — **step 2a, on the same branch, live-tested on Windows 2026-09-20 (checklist below passed); Linux unverified**
- [ ] → moved to [0130](../later/0130-multi-file-save-follow-ups.md): Focus/panel-open check → one notice for every file (Reload / Ignore, minimal reload, marks files with unsaved edits)
- [x] Diagram reload keeps unsaved note edits (done with 2a, also for the toolbar Reload)
- [ ] → moved to [0130](../later/0130-multi-file-save-follow-ups.md): dirty orphans (element gone) surfaced in Diagnostics instead of an alert / discarded on Save
- [ ] → moved to [0130](../later/0130-multi-file-save-follow-ups.md): remove the remaining special-casing of the diagram vs notes in the notices

## Live-test checklist for step 1
1. **Plain save:** edit the diagram, Save — file written, "Saved" flash. Ctrl+S on a clean diagram writes nothing (file's modified time unchanged).
2. **Note only:** open a note, type, Save — the `.md` changes; the `.chd` file's modified time does **not** (git shows only the `.md`).
3. **New note:** open a shape with no note, type, Save — `<diagram>/details/<Label>-<id>.md` created and the `.chd` now references it. Opening a note and typing nothing creates no file.
4. **Rename:** change a shape's label (with a note), Save — the note file is renamed to match; the `.chd` points at it; reopening shows the same text. Same with unsaved note edits.
5. **Conflict:** edit a note in the app, edit the same `.md` externally, Save — everything else still saves first (including an edited diagram), then one popup names the conflicting note; Cancel leaves it unsaved (window stays dirty) and Overwrite replaces the file. Repeat with the `.chd` changed externally (the diagram is held back; in-place note edits still save), and with both at once (one popup, both listed).
6. **No false conflict:** an outside edit to a note you did *not* edit, or to one that's closed, must not block Save.
7. **Focus notices** still appear (diagram banner; open-note notice) and Reload works.
8. **Close / crash recovery:** unsaved note text keeps the window "dirty" (close prompt). After a forced kill **at least ~6 s after your last edit** (snapshots are now every 5 s when something changed; it was 60 s) the recovery prompt restores diagram and note text. Also: edit md + chd, Save with the md conflicting, kill the app **while the popup is open** — the recovery prompt should still offer the unsaved note; if the file changed outside meanwhile, saving the restored note should still raise the conflict.
9. **Save As** to a new location works; a brand-new diagram's first Save works.
10. **Known/accepted:** deleting a shape that has unsaved note text and then saving discards that text; Save As doesn't copy unopened notes (as before).

## Live-test checklist for step 2a (per-file conflict dialog)
Use a diagram with at least two notes. "Conflict" = edit the note in the app, then edit its `.md` outside the app, then Save.
1. **One note conflicts:** the dialog lists just that note; nothing is preselected and Apply is disabled. Keep mine → the file is overwritten. Repeat with Take disk → the panel shows the disk text and my text is gone; the window is no longer dirty.
2. **Two notes conflict, different answers:** conflict on notes A and B; choose Keep mine for A and Take disk for B. A's file has my text, B's has the outside text, both saved silently afterwards. Also try "Keep mine for all" / "Take disk for all".
3. **Cancel / Escape:** everything else is saved, the conflicting notes stay unsaved (window dirty, no "Saved" flash). Save again → the dialog returns.
4. **Diagram conflict, Keep mine:** edit the diagram and change the `.chd` outside; Save → dialog names "The diagram file"; Keep mine overwrites it.
5. **Diagram conflict, Take disk:** same, choose Take disk → the diagram reloads from disk, a message says so, unsaved *note* edits are still there (open the note), and the save stops (save again to finish).
6. **Diagram + a note both conflict:** choose Take disk for the diagram and Keep mine for the note → the note is written, the diagram reloads.
7. **Rename + conflict:** rename a shape that has a note AND conflict on that note; choose Take disk → the note file is renamed to the new label and holds the *disk* text.
8. **Crash recovery still consistent:** after resolving in the dialog, kill the app and reopen — no "recover" prompt for edits you just resolved. After Cancel + kill, the prompt does appear.
9. **Toolbar Reload** with unsaved note edits keeps them; with unsaved diagram edits it warns that those are lost.
