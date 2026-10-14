# 0117: "Changes since last save" overview

## Status
Implemented (2026-10-01), on `epic/0117-changes-since-last-save`, pending
live test/PR/merge. See [ADR 0102](../decisions/0102-changes-since-last-save-scope.md)
for v1 scope and mechanism. `typecheck`/`lint`/`npm test`/`npm run build`
clean (109 tests, 9 new). Logged 2026-09-11 from a user ask. The user's own
framing: "Right now, there is no way to know what has changed without doing
the save and checking git. If I do not want to save, that is not good enough."

## Goal
An on-demand view of what's changed in the currently-open diagram versus the
file on disk (the last save, or the empty starting point if never saved) —
usable without saving, either as its own window/panel or surfaced at the
save/discard decision point.

## Feasibility (2026-09-11 assessment)
**Not hard — medium-sized, comparable to the Diagnostics "missing files"
work ([epic 0108](completed/0108-diagnostics-missing-files.md)) or the
security-matrix rollup crawl ([epic 0081](0081-recursive-matrix-population-and-automation.md)).**

- **[ADR 0040](../../decisions/0040-dirty-tracking-and-autosave-design.md)
  already scoped this.** A full deep-diff against the last-saved file was
  considered directly for driving the dirty *boolean* and rejected only
  because that use needs to run continuously (every drag frame) and would
  need real value-comparison + throttling. Neither objection applies to an
  **on-demand** diff (opened by the user, or computed once at close) — this
  epic is that shelved approach, minus the part that made it a bad fit for
  the boolean.
- **The diff itself is a standard id-keyed structural diff.** Every node/edge
  has a stable id: added (id only in current), removed (id only in saved),
  modified (id in both, changed) — with modified rows listing which fields
  differ (position, size, style, `data.label`, tags/metadata,
  `data.security`, `data.linkedDiagram`, …). Same treatment, one diff each,
  for the top-level collections: `requiredTags`, `highlights`, `legend`,
  `gravityPresets`, `security` (catalog + `matrixShapeIds`),
  `edgeDirectionSets`, `metadata`, `maxConnectionPointsPerSide`.
- **What to diff against:** re-read the file at `currentPath` from disk —
  no new in-memory "snapshot at last save" needed. Reuses
  `openDiagramAtPath` (`src/main/diagram.ts`) behind a new **side-effect-free**
  IPC (must NOT call `recordOpenedOrSaved`, same requirement as
  `security:crawlLinked`). A diagram with `currentPath === null` (never
  saved) diffs against `createEmptyDiagram()`.
- **Constraint found in the code:** the Save/Discard/Cancel close prompt
  (`windows:requestCloseDecision` in `src/main/windows.ts`) is a **native OS
  `dialog.showMessageBox`** — buttons + plain text, no list, nothing
  clickable. A rich, reviewable diff can't live inside it.

## Decided 2026-10-01: shape and v1 scope

See [ADR 0102](../decisions/0102-changes-since-last-save-scope.md) for the
full record. Summary:
- **v1 diffs nodes/edges only** — the 8 top-level collections
  (`requiredTags`, `highlights`, `legend`, `gravityPresets`, `security`,
  `edgeDirectionSets`, `metadata`, `maxConnectionPointsPerSide`) are a
  fast-follow, not v1.
- **A dock panel**, same UI family as Diagnostics/Layers: grouped Added /
  Removed / Modified sections, each row click → select + frame the element
  on canvas (reuses `revealNode`). Openable any time (View menu / command
  palette), not gated on closing.
- **Details-file edits get their own bucket**, reusing `noteShadows`'
  existing `dirty` flag (ADR 0092) — no new tracking, no content diff.
- **The native close-prompt stays native**, gains a one-line count via a new
  optional `detail` parameter on `requestCloseDecision`. No separate
  Discard-specific gate — Cancel is the existing safety net.
- **Mechanism**: a new side-effect-free IPC (never calls
  `recordOpenedOrSaved`, same precedent as `security:crawlLinked`) rereads
  the file at `currentPath` via `openDiagramAtPath`; a new pure
  `src/shared/changesSinceSave.ts` diffs it against `toDiagramFile(...)`'s
  live output by id.

## Future extension, deliberately not designed yet (2026-09-11, refined 2026-09-11)

The user's own framing: "each change should be revertible in isolation" —
not just *viewing* what changed, but selectively reverting one detected
change while keeping the rest. Explicitly parked to "let bake a bit longer."

**Semantics clarified by the user — this is not Ctrl+Z.** Undo is
chronological (one *action*, whoever it belonged to). This is scoped: reset
one *element* to exactly its last-saved state, discarding every action that
touched it since, regardless of how many there were. `git checkout -- <path>`
for one element, not `git revert` of a specific commit.

**Mechanism (the user's proposal, confirmed correct with one refinement):**
reread the file from disk — already needed for the diff itself — but splice
back only the one element being reverted, not the whole in-memory diagram
(a wholesale reread would revert everything, defeating "in isolation").
Three cases by id:
- **Modified** → replace the live node/edge with the saved one.
- **Added since save** → delete it from the live state.
- **Removed since save** → re-insert the saved one.

This is simpler than first thought — my earlier note below (kept for the
record) worried about needing a new patch-shaped mechanism because it
pictured *per-field* reverts. **Whole-element revert doesn't have that
problem**: it's just another node/edge mutation, so it goes through the
existing `setNodes`/`pushSnapshot` path like any edit — Ctrl+Z can undo the
revert itself for free, no second history mechanism needed.

Two things this sharpens:
- **Shape vs. Details isn't an arbitrary granularity choice — the mechanism
  forces it.** Reverting "the shape" is an in-memory node-array splice.
  Reverting "the Details content" means rereading the sibling `.md` file and
  discarding the draft — genuinely different operations (`data.details` is
  never embedded in the node; see `docs/file-format.md`). If isolation ever
  needs to go finer than "whole element," shape+Details is the natural first
  seam.
- **Edge case to flag, not solve:** reverting a shape's saved size/connection
  points could leave a live edge pointing at a connection point that no
  longer exists post-revert. Likely covered by the existing dangling-reference
  self-healing ([ADR 0075](../../decisions/0075-container-hierarchy-integrity.md))
  rather than needing new logic — worth confirming when this is built.

**UI naming note:** call it "Reset to saved" / "Revert to saved," not
"Undo" — it needs to read as a different operation from Ctrl+Z.

**What counts as one revertible unit is still open** (whole element only,
vs. also per-field within an element) — the above resolves the *mechanism*
for whole-element revert, not whether finer granularity is ever wanted.

<details>
<summary>Superseded first-pass note (2026-09-11, kept for the record)</summary>

A real design tension flagged before the semantics were clarified: the app's
undo model ([ADR 0018](../../decisions/0018-undo-redo-explicit-snapshots.md))
is whole-snapshot based, not per-field patches, so "revert just this one
field" doesn't fit that primitive and would need a second, patch-shaped
mechanism alongside undo/redo. This concern doesn't apply to whole-element
revert (see above) — it would only resurface if per-field granularity is
ever wanted.
</details>

## Tasks
- [x] Design pass — ADR 0102 (v1 scope, mechanism)
- [x] `src/shared/changesSinceSave.ts` — pure id-keyed node/edge diff (added/removed/modified, modified rows list which fields differ), unit-tested (`changesSinceSave.test.mjs`)
- [x] Side-effect-free `diagram:rereadForDiff` IPC (main + preload + `.d.ts`)
- [x] `ChangesPanel.tsx` — dock panel, grouped Modified/Added/Removed sections, row click → `focusSearchMatch` (works for both nodes and edges); Details-changed bucket from `noteShadows`' existing dirty flag
- [x] Wire into View menu + `commands.ts` (`view.changesSinceLastSave`) — shows up in the command palette for free (ADR 0100 flattens the menu bar); no shortcut assigned
- [x] Extend `requestCloseDecision` with optional `detail?: string`, computed from the diff via `buildCloseChangesSummary`, forwarded into the native dialog
- [x] `typecheck` / `lint` / `npm run build` clean
- [ ] Live test in the Electron renderer (user)

## Relationship to existing behavior
- Diff engine + panel is purely additive; no `.chd` schema change.
- Natural home for the diff engine: a new pure module (`@shared` or
  renderer), similar precedent to `threatMatrixMath.ts`'s pure-arithmetic
  module.
- Could reuse `toDiagramFile()` (`Canvas.tsx`) as the "current state"
  serialization side of the diff, so it's comparing exactly what a save
  would write.

## Notes
Not scheduled. Logged the same day epic 0081 merged (PR #92).
