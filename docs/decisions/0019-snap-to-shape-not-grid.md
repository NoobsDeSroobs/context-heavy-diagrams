# 0019: Snap-to-shape only, no snap-to-grid; connection-aware alignment deferred

## Status
Accepted

## Context
The alignment-and-snapping work needed to decide what "alignment and snapping while dragging" actually means in practice. Two genuinely different ideas were on the table under that one epic title: snapping a dragged node into alignment with *other nearby shapes* (proximity-based, visual guide lines), and snapping to a fixed *grid*. A third, related idea — aligning a node with whatever it's *connected to* via an edge, not just whatever's nearby — surfaced during the same scoping conversation and turned out to be a much bigger fork than a small addition to either of the above.

## Decision
**Proximity-based snap-to-shape only, no snap-to-grid.** A dragged node's edges/center snap into alignment with another node's edges/center within a 5 screen-pixel threshold (converted to flow-space units by dividing by zoom, so it feels consistent at any zoom level) — not requiring edges to touch, so two shapes with a gap between them can still snap into a matching column/row. No grid concept exists anywhere in the data model or UI.

**Connection-aware alignment (aligning a node with what it's connected to) is deferred to its own epic**, not folded into this one. It was recognized as a genuine fork, not a small extension: a lightweight version could reuse this epic's own snap mechanism (treat "connected neighbor" as just another alignment source alongside "nearby shape"), but a *real* version would mean pulling in an actual graph auto-layout algorithm (e.g. dagre, elk) and rethinking the interaction entirely (a "tidy up" command rather than a drag-time behavior). Which of those (if either) is actually wanted needs real diagram-building experience to inform — not something to guess at now. Tracked as its own backlog item, not yet scoped.

## Alternatives considered
- **Snap-to-grid** (in addition to or instead of snap-to-shape): rejected — not the model wanted for this tool; proximity-based alignment to actual diagram content was judged more useful for architecture diagrams than a fixed coordinate grid.
- **Folding connection-aware alignment into this work directly**: rejected once the lightweight-extension-vs-auto-layout fork became clear — implementing either without knowing which is actually wanted risks building the wrong one, or building both and only needing one.

## Consequences
- The snap geometry lives in a small, pure, framework-free module (`src/renderer/src/alignment.ts` — `boundsFrom`, `computeSnap`), independent of React Flow's own APIs. This is what a "lightweight extension" path for connection-aware alignment would build on directly if that's the direction chosen.
- No grid-snapping UI/preference exists anywhere (toolbar, settings, or otherwise) — adding one later is a new feature, not a toggle on existing code.
- Alignment guides and snapping are drag-time-only, not extended to resizing (a deliberate scope boundary of this work) — a natural, separate follow-up if wanted later.
