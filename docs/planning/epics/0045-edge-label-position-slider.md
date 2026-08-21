# 0045: Edge label position slider

## Status
Not Started — not yet scoped. Raised by the user (2026-08-20). Deliberately not designed here, just captured so it isn't lost, same as epics 0024/0026/0030/0037-0044. Explicitly told not to build yet.

## Goal
A control (the user's own suggestion: a slider) to move an edge's label along the edge's path — default at 0.5 (the midpoint, today's only option), adjustable toward either end when the midpoint placement makes the label hard to read (overlapping another edge, sitting on a sharp bend, etc.).

## Relevant existing behavior
This is a deliberate v1 simplification from [epic 0012](0012-editable-anchored-labels.md) (Done), which shipped edge labels fixed to the path midpoint on purpose: "fixed midpoint only, no drag-along-path for v1 — same reasoning, simplest useful default, add interaction complexity only once it's actually needed." That epic's own notes anticipated this exact follow-up. `LabeledEdge.tsx` computes the label position as the second/third return values of React Flow's `getBezierPath` (`labelX`, `labelY`), which is a fixed-ratio midpoint calculation — moving the label would mean computing a point at an arbitrary ratio along the path instead, not just the midpoint.

## Real open questions (deliberately not resolved here)
- **Data model** — a new field on `DiagramEdge`/`EdgeStyle` (e.g. a 0-1 ratio along the path, same convention as `ConnectionPoint.offset`) needs adding to `docs/file-format.md`. Absent should mean 0.5, so existing files keep rendering exactly as they do today.
- **UI surface** — where does the slider live? The property panel (epic 0003) alongside other edge style fields is the obvious candidate, but worth confirming rather than assuming.
- **Path-ratio vs. pixel-distance** — a 0-1 ratio along the path (matches `ConnectionPoint.offset`'s own convention) stays meaningful if the edge's endpoints move; a fixed pixel offset from one end wouldn't. Leaning toward ratio for consistency, not decided.

## Notes
Not scheduled into the current batch (see [PROGRESS.md](../../../PROGRESS.md)) — flagged here so it's on the backlog and not lost, not because it's next up.
