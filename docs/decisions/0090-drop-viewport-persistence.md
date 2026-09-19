# 0090: Drop camera position (viewport) from the persisted `.chd` file

## Status
Decided and implemented (2026-09-16).

## Context

Since [ADR 0003](0003-diagram-persistence-v1.md), `DiagramFile` has carried a top-level `viewport: { x, y, zoom }` — the canvas's pan/zoom at the moment of the last save, restored on the next open. It was already excluded from undo/redo history (panning/zooming isn't a content edit worth undoing), but it was still written on every save.

In practice this meant a save triggered by a real content edit — the only time a save happens, since panning/zooming alone never marks the diagram dirty — could still carry an unrelated `viewport` line in the diff if the user had also panned or zoomed during that editing session. For a tool whose stated design goal is clean, meaningful git diffs, that's a real cost for a feature that is purely cosmetic (it has no effect on what the diagram *is*).

## Decision

Remove `viewport` from `DiagramFile` entirely. `createEmptyDiagram()`, `toDiagramFile()`, and `serializeDiagram()` no longer produce it; loading a diagram no longer calls `rfInstance.setViewport(...)`. A file written by an older build may still have a `viewport` key at the top level — `parseDiagram()` doesn't validate strictly, so it's simply ignored and dropped the next time that file is saved (standard "old field falls away silently" behavior, same as any other field this format has never round-tripped strictly).

This is a straight removal, not a migration to some other storage — every diagram now always opens at React Flow's own default viewport (whatever `fitView`/initial state produces) rather than wherever it was last left.

## Alternatives considered

- **Keep it, but round/snap the stored values** (e.g. nearest 10px, 2 decimal zoom) so incidental panning doesn't perturb it. Doesn't address the actual problem — ordinary usage (reposition, then zoom in to work on a detail) still changes it most sessions it's touched at all.
- **Move it out of the tracked file into app-local state**, keyed by absolute file path (or a content hash) under Electron's `userData`, the way an editor like VS Code remembers per-file cursor position without writing it into the file itself. This keeps the "reopen where you left off" behavior with zero git-diff cost, but is real new surface: a new store, a path-identity question (renames/moves orphan the entry), and cleanup behavior if a diagram is deleted or the app is uninstalled. Not implemented now — parked as the option to revisit if losing the resume-camera behavior turns out to matter in practice, at which point it deserves its own design pass rather than being bolted on speculatively here.

## Consequences

- Every save's diff is now purely about diagram content — no more incidental viewport churn.
- Reopening a diagram (or navigating into a linked one) always starts at the default view rather than wherever the camera was left; on a large diagram this may take an extra pan/zoom to get back to the area of interest.
- `docs/file-format.md` no longer documents `viewport` as a field; a compatible third-party writer doesn't need to produce one, and a reader can just ignore it if present.
