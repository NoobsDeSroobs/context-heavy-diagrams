# 0129: Unified multi-file save and change tracking

## Status
Not Started — raised 2026-09-19 by the user while live-testing [epic 0128](0128-external-change-detection-and-save-conflict-warning.md).
**Needs a design conversation first** (philosophy, then ADR, then refactor). 0128 was
parked as-is on purpose; this epic is where its structural duplication gets fixed.

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
  ([ADR 0084](../../decisions/0084-diagnostics-missing-files.md)-era) happen **at save**;
  custom icons (`icons:pickAndCopyCustom`), reference images (`references:pickAndCopy`)
  and a new linked diagram (`links:createNew`) are written to disk **immediately** at
  pick time. Nothing states the rule for which is which.
- Per-file dirtiness doesn't exist: one `isDirty` boolean for everything
  ([ADR 0040](../../decisions/0040-dirty-tracking-and-autosave-design.md)); a note's
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

## Sketch (not decided)
- A **tracked-file registry** in the main process, per window: for each file the window
  owns (`.chd`, each detail note, later maybe others) `{ path, kind, baselineStamp }`.
  One `checkAll()` → list of externally changed files; used by the focus check, the
  save-time guard, and the "changes since last save" panel
  ([0117](0117-changes-since-last-save.md)) — **one place** that knows about disk changes.
- Save = the renderer builds a **changeset** (write / rename / delete ops with the
  content and expected baseline for each); main verifies all baselines, prompts once,
  applies in dependency order, returns the new baselines. Logic (and tests) live in
  main, not spread through `Canvas.tsx`.
- Decide the **staged vs immediate** rule for icons, references, linked-diagram
  creation, removals. Candidate rule: *creating* an additive asset may be immediate
  (nothing to conflict with); *modifying, renaming or deleting* existing content is
  staged until save.

## Open questions for the design conversation
- Is the changeset built in the renderer (it owns the state) and executed in main, or is
  more of the model moved to main?
- Per-file dirtiness: worth tracking explicitly, or keep the single boolean and derive
  per-file where needed?
- What does "Overwrite / Reload" mean per file when only *one* of several files
  conflicts — per-file choice, or one choice for the whole save?
- Should recovery/autosave ([ADR 0040](../../decisions/0040-dirty-tracking-and-autosave-design.md))
  snapshot the same changeset model?
- Consumers to design against: 0128 (refactor onto it), 0117, 0115 (data-loss safety),
  and any future file kind (drill-down search 0093 / parent discovery 0122 only read).
- LLM-friendliness: a plain changeset/plan is also something a script or skill could
  produce or inspect.

## Explicitly not in scope
No `fs.watch`/file watcher, no in-app merge (git remains the merge tool) — both settled
in [ADR 0091](../../decisions/0091-external-change-detection.md).

## Tasks
- [ ] Design conversation → ADR (philosophy: plan/execute, staged-vs-immediate rule, failure policy)
- [ ] Tracked-file registry + `checkAll()` in main
- [ ] Changeset save path; migrate `persistDiagram`/`flushDetailsDrafts`
- [ ] Re-home 0128's focus notices and popup onto the registry (behaviour unchanged)
- [ ] Decide and apply the staged/immediate rule to icons, references, link creation
