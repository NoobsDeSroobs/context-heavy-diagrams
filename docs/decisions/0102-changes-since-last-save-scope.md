# 0102: "Changes since last save" — v1 scope and mechanism

## Status
Decided (2026-10-01).

## Context
The wish is for an on-demand view of what's changed in the open diagram versus the file on disk, usable without saving. The feasibility pass (2026-09-11) scoped a fairly large diff: nodes/edges plus all eight top-level collections (`requiredTags`, `highlights`, `legend`, `gravityPresets`, `security`, `edgeDirectionSets`, `metadata`, `maxConnectionPointsPerSide`). It also left open whether Details-file edits belong in the view at all, and whether the Discard step needs a stronger gate than the existing native close-prompt.

## Decision

**v1 diffs nodes and edges only** (position, size, style, label, metadata/tags, security, `linkedDiagram`, connection points) — not the eight top-level collections. Those change far less often per editing session than node/edge content does; diffing them adds real work (each has its own identity key — `id` for most, `key` for `requiredTagDefinition`, `key`+`value` for `HighlightDefinition`) for a case that isn't the common one. Fast-follow, not dropped.

**Details-file edits get their own bucket, reusing existing state — no new tracking.** `noteShadows` (`src/shared/documentSave.ts`, ADR 0092) already maps node id → `NoteShadow` with a `dirty` boolean, kept current by the unified multi-file save (ADR 0092). The diff view lists "N elements have unsaved Details changes" straight from `anyNoteDirty`/the dirty subset of `noteShadows` — no content diff, no new dirty-tracking mechanism.

**The close-prompt gets a one-line count, no new gate.** `windows:requestCloseDecision` (`src/main/windows.ts`) takes no arguments today and shows a bare native `dialog.showMessageBox` (Save/Discard/Cancel, no `detail` text). Extend it to accept an optional `detail?: string`, computed renderer-side from the same diff engine (e.g. `"3 modified, 1 added, 1 removed"`), forwarded into the dialog's `detail` field. No separate confirmation step at Discard specifically — Cancel is already the safety net, and a second gate is friction without a corresponding new risk (the count is already visible before the user commits to Discard).

**Mechanism**: a new side-effect-free IPC, following the `security:crawlLinked` precedent (never calls `recordOpenedOrSaved`) — rereads the file at `currentPath` via the existing pure `openDiagramAtPath` and returns the parsed `DiagramFile`, nothing more. The renderer builds the live side with the existing `toDiagramFile(...)`, and a new pure diff module (`src/shared/changesSinceSave.ts`, same precedent as `threatMatrixMath.ts`) compares the two `.nodes`/`.edges` arrays by id: added (id only in current), removed (id only in saved), modified (id in both, differing — with a list of which fields differ). A diagram with `currentPath === null` diffs against `createEmptyDiagram()`.

## Alternatives considered
- **Full scope from day one** (all 8 collections). Rejected for v1 — more surface area before anything ships, for collections that change far less often than nodes/edges. Revisit as a fast-follow once the node/edge diff is live and it's clear whether the collections are actually missed.
- **A custom in-app modal replacing the native close-prompt**, so a rich list (not just a count) could show at the Discard decision point. Rejected — rewriting ADR 0040's close flow is a separate, larger, riskier change for a benefit (a list at exactly that moment) the View → Changes panel already covers on demand.
- **Content-diffing Details files** (not just a dirty flag). Rejected — `noteShadows` already has everything the diff view needs (which elements are dirty); a real text diff of Markdown content is a bigger, separate feature with no clear demand yet.

## Consequences
- The 8 top-level collections (highlights, legend, gravityPresets, security catalog, edgeDirectionSets, requiredTags, metadata, maxConnectionPointsPerSide) are **not covered by v1** — a change to any of them alone won't show up in the diff view or the close-prompt count. Flagged as a known gap, not a silent one.
- `requestCloseDecision`'s IPC signature changes (gains an optional `detail?: string` parameter) — both `src/preload/index.ts` and `index.d.ts` need updating alongside `src/main/windows.ts`.
- No `.chd` schema change.
