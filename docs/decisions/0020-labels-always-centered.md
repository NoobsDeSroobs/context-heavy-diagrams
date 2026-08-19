# 0020: Shape/text labels are always centered — no freeform or anchored positioning

## Status
Accepted

## Context
Epic 0012 originally started from the framing "editable labels, positioned relative to an anchor" (the brief and early planning imagined a label that could be biased toward a particular position on its shape, not necessarily dead-center). That needed resolving into an actual decision once the epic was implemented: does `DiagramNode` get an anchor/position field for its label, and does the user get to drag it?

## Decision
**Labels are always centered, with no anchor field on `DiagramNode` at all.** This falls out for free from the existing flexbox layout already used to render a node's label — no new schema, no new interaction. Freeform 2D label positioning was considered and explicitly rejected, not just left undone: it reintroduces a real UX ambiguity that [ADR 0017](0017-node-as-single-draggable-entity.md)'s single-draggable-entity principle exists specifically to avoid — click-and-drag on a shape already means "move the shape," so a draggable label sitting on top of that would be a second, conflicting meaning for the same gesture, on the same element, with no obvious way to disambiguate which one the user means without extra UI (a mode toggle, a different modifier key, etc.) that wasn't judged worth the complexity without a proven need.

## Alternatives considered
- **An anchor/offset field, freeform-draggable**: rejected for the click-drag-ambiguity reason above. Not ruled out permanently — if corner-icon collision (icon slots, epic 0007, render at the true corners) turns out to be a real problem in practice, two narrower options are on the table for later, neither built now: a floating "bias toward top/side/bottom/corner" setting (no free-drag, so no gesture conflict), or freeform movement after all, but only once there's an actual design for resolving the move-shape-vs-move-label conflict (a modifier key, a distinct label-drag handle, etc.).
- **Edge labels dragged along their path**: same reasoning, deferred rather than built — edge labels render at the path's fixed midpoint only for v1.

## Consequences
- `DiagramNode`/`DiagramEdge` schemas stay simpler — no label-position field to persist, migrate, or keep in sync with resize/rotate.
- If icon-corner collision becomes an actual reported problem, this decision is the first thing to revisit — the two fallback options above are already scoped as *options*, not designed, so real design work would still be needed at that point.
- Text alignment (start/center/end, i.e. how text sits *within* its centered box) is a separate, narrower concern than position and was moved to epic 0003's styling panel rather than resolved here.
