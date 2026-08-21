# 0042: Edge label renders behind its own edge line

## Status
Not Started — bug report, not yet root-caused. Raised by the user (2026-08-20) while reviewing the C4 gallery diagrams (several have busy hubs — `booking-api-component.chd` has 11 edges meeting at one node). Explicitly told not to fix yet, just log it.

## Goal
An edge's label should always render visually in front of its own line (and ideally anything else it overlaps), so it stays legible regardless of how the edge is routed or what crosses it.

## Relevant existing behavior
`src/renderer/src/edges/LabeledEdge.tsx` already uses React Flow's `EdgeLabelRenderer` — which exists specifically to portal edge labels outside the SVG edges layer so they can be styled with normal HTML/CSS and (per React Flow's own design intent) render above edges. `main.css`'s `.edge-label-text:not(:empty)` rule already gives a non-empty label a background chip (`background: var(--color-background-soft)`), which should visually occlude whatever is beneath it. On paper, both of these already point at "label renders on top" — a quick look didn't turn up an obvious cause for the reported behavior, which is why this is filed as unconfirmed rather than as a located bug with a known fix.

## Real open questions (deliberately not resolved here)
- **Exact repro conditions** — every edge, or only specific cases (many edges converging on one node, a particular zoom level, a specific edge style)? Not yet reproduced/confirmed independently.
- **Root cause candidates, none confirmed**: a stacking-context interaction between React Flow's `.react-flow__edges` (SVG) layer and the `EdgeLabelRenderer` portal container (possible z-index ordering issue between the two, either from this app's own CSS or React Flow's defaults); or the label rendering above its *own* edge but below *other* edges/nodes that happen to overlap it, which would read the same to a user even though the mechanism is different.
- **Relationship to epic 0043** (layer order / z-height control, also just logged) — worth checking once that's scoped whether this is a symptom of there being no general z-ordering model at all, or a narrower, unrelated CSS bug that'd need fixing either way.

## Notes
Not scheduled into the current batch (see [PROGRESS.md](../../../PROGRESS.md)) — flagged here so it's on the backlog and not lost, not because it's next up.
