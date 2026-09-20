# 0130: Multi-file save follow-ups (technical debt)

## Status
Not Started — parked on purpose, logged 2026-09-20. **Technical debt, to be done later**, not
a scheduled epic. Split off from [epic 0129](../completed/0129-unified-multi-file-save-and-change-tracking.md)
when its save side (shadow model, one save plan, per-file conflict dialog, reload that keeps
unsaved notes) was finished and live-tested: what remains is refinement, and the queued batch
([0119](../completed/0119-details-peek-on-modifier-hold.md) → [0120](../0120-help-keyboard-shortcuts-page.md)
→ [0121](../0121-copy-style-apply-mode.md)) goes first. Design is already agreed in
[ADR 0092](../../../decisions/0092-unified-multi-file-save-and-change-detection.md); no new
design conversation is needed for the first two items.

## Items

### 1. One notice for every file, with a minimal reload
The "changed outside the app" notice is still two separate mechanisms: a toolbar banner for the
diagram file and an open-note notice for the one open note. ADR 0092 wants **one** notice on
window focus / panel open, identical for every tracked file:
- lists every changed tracked file (the diagram + notes that are dirty or open), marks the ones
  with unsaved edits here, **Reload / Ignore**;
- **Reload is minimal** — reloads only the files that changed (the diagram, note 44, or both).
  The building blocks exist: `files:check` takes any number of entries and a diagram reload
  already keeps unsaved notes; what's missing is a note-level reload and the unified UI;
- a Reload that would discard unsaved edits asks first; **Ignore** remembers the specific change
  per file (as today), the save-time dialog still fires;
- deliberate behaviour change: an *unedited* open note that changes on disk raises the notice
  instead of refreshing silently, so every file behaves the same.

### 2. Orphaned unsaved note edits surfaced in Diagnostics
Unsaved text in a note whose element is gone is currently **alerted and discarded** (after a
diagram reload) or **dropped on Save** (deleted shape). ADR 0092 says such edits are kept and
surfaced, never silently discarded: list them in the Diagnostics panel with Discard (and, later,
"relink by original path" — shadows already keep their original path for this).

### 3. Smaller loose ends
- **Drop clean note copies on every panel-close path**, not only the ✕ button (harmless today —
  clean copies are never written and the open-time check refreshes stale ones — but ADR 0092 §8
  intends it).
- **Save As doesn't copy notes that were never opened** to the new folder, so their references
  break. Pre-existing limitation (was true before 0129); the planner already knows every note,
  so it can copy them.
- **Verify on Linux**: file-stamp/mtime granularity, native dialog behaviour, the recovery
  folder — for 0128 and 0129 both (the project's cross-platform rule).
- **`persistDiagram` is now a large orchestration inside `Canvas.tsx`.** Extract the save flow
  (plan → save → resolve conflicts → apply results) into its own module/hook; the pure parts are
  already in `src/shared/documentSave.ts`. Also the natural point to add renderer-level tests if a
  React test setup is ever introduced (today only the pure planner/executor/resolver are tested).

## Tasks
- [ ] Unified change notice + minimal reload (item 1)
- [ ] Orphaned edits in Diagnostics (item 2)
- [ ] Drop clean copies on all close paths
- [ ] Save As copies unopened notes
- [ ] Extract the save orchestration out of `Canvas.tsx`
- [ ] Verify 0128/0129 on Linux
