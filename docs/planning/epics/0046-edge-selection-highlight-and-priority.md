# 0046: Edge selection highlight and grab priority

## Status
Not Started — not yet scoped. Raised by the user (2026-08-20). Deliberately not designed here, just captured so it isn't lost, same as epics 0024/0026/0030/0037-0045. Explicitly told not to build yet.

## Goal
Two related asks, both about making it easier to work with edges that converge or overlap at one point:
1. **Visual feedback on selection** — a selected edge should look visibly selected (the user's suggestion: render it a little thicker), the same way selected nodes already get visible feedback.
2. **Grab priority** — once an edge is selected/clicked, it should take precedence for future grab/drag interactions at that location, so a user can reliably move *that specific edge* even when several edges meet at the same node or connection point, rather than fighting over which one the next click happens to hit.

## Relevant existing behavior
Confirmed by reading the code: `LabeledEdge.tsx` doesn't use React Flow's `selected` prop at all (it's not even destructured from `EdgeProps`), and there's no CSS anywhere targeting a selected-edge state (`grep` for `selected`/`.react-flow__edge` selection styling in `main.css` and the edges folder found nothing). This is a real, confirmed gap, not a maybe — edges currently have zero visual selection feedback.

## Real open questions (deliberately not resolved here)
- **Highlight mechanics** — the user's own suggestion is a thicker stroke on selection. Need to make sure this doesn't collide with the existing highlight-overlay border-width override (`HIGHLIGHT_BORDER_WIDTH`, epic 0026/ADR 0025) — an edge could in principle be both tag-highlighted *and* selected at once, and the two visual treatments need to coexist or have a clear precedence.
- **"Takes precedence when trying to grab" — exact mechanics.** Does selecting an edge change hit-testing *only* for that edge (e.g. a temporarily enlarged/prioritized hit area), or does it change ordering more generally? This is a hit-testing/interaction-priority question, not just a CSS one — needs a real look at how React Flow resolves overlapping-edge clicks today before deciding what "priority" even means to implement.
- **Relationship to epic 0043** (layer/z-height control, also unscoped) — grab priority for a selected edge is arguably a narrow, interaction-specific instance of the general layering problem 0043 is about. Worth checking once either is scoped whether one subsumes the other, or whether they're independent enough to build separately (visual selection + click priority don't obviously need a general z-index model to work).

## Notes
Not scheduled into the current batch (see [PROGRESS.md](../../../PROGRESS.md)) — flagged here so it's on the backlog and not lost, not because it's next up.
