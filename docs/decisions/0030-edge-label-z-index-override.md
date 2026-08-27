# 0030: Force edge labels above the z-index ceiling with a single CSS override

## Status
Accepted

## Context
Edge labels were reported sometimes rendering behind their own edge line, first noticed on busy hubs in the C4 gallery diagrams. Root-causing it (by inspecting the running app's DOM, not just reading source) turned up two independent causes, both stemming from the same gap:

- Canvas.tsx's `zIndexedNodes` gives every non-container node an inline `zIndex: 2000`, unconditionally, so React Flow renders `z-index: 2000` on every `.react-flow__node`. `.react-flow__edgelabel-renderer` — the single shared div React Flow's `EdgeLabelRenderer` portals every label into — gets no z-index at all (`auto`), so it already lost to any node it overlapped, which is exactly what happens near a busy hub.
- `@xyflow/system`'s `getElevatedEdgeZIndex` gives each edge's own SVG wrapper an explicit z-index, elevated by 1000 when the edge is selected (`elevateEdgesOnSelect` defaults to `true` and isn't overridden here) and, independently, bumped to match either endpoint node's full z (2000+) whenever that node has a `parentId` (lives inside a container) or is itself selected. An edge connecting two contained nodes — the normal case in every container-heavy diagram this app is built for — has its line elevated above the un-elevated label by default, with no selection involved at all.

Both are the same underlying gap: the app's zIndex scheme (Canvas.tsx) and React Flow's own elevation logic (`@xyflow/system`) can push a node or edge's z-index arbitrarily high, but the shared label-portal container was never given a z-index that accounts for that ceiling.

## Decision
Add one rule to `main.css`:

```css
.react-flow__edgelabel-renderer {
  z-index: 5000;
}
```

5000 is chosen with headroom over today's known ceiling (2000 node + up to ~2000 more from elevation, per the two mechanisms above), not derived programmatically. The rule carries a comment cross-referencing Canvas.tsx's `zIndexedNodes` and this decision, so a future change to that scheme has something to trip over.

This directly overrides a React Flow-owned class name (`.react-flow__edgelabel-renderer`), which the codebase already does elsewhere (`.react-flow__handle` overrides in `main.css` for per-node-type visibility) — not a new pattern.

## Alternatives considered
- **Give the label's own wrapper div (`.edge-label` in `LabeledEdge.tsx`) a z-index instead of the shared portal container.** Doesn't work: all labels share one `.react-flow__edgelabel-renderer` stacking context, so an individual label's own z-index only reorders it against *other labels*, not against nodes/edges outside that container. The container itself has to move.
- **Compute per-edge z-index dynamically (`zIndexMode: 'manual'` + our own calculation) to keep labels exactly one level above their own edge, no higher.** More correct in principle, but substantially more code for a problem a single high constant already solves, and it would need to duplicate React Flow's own elevation math to stay in sync. Rejected for now; revisit if layer/z-height control introduces a real user-facing z-ordering model that this should participate in rather than sit permanently on top of.
- **Lower Canvas.tsx's node zIndex ceiling instead of raising the label's.** Rejected — that 2000/0 split has its own documented purpose (containers always behind shapes/text, [Canvas.tsx:1852](../../src/renderer/src/Canvas.tsx)) unrelated to labels, and touching it risks the container-behind-shape guarantee it exists for.

## Consequences
- Edge labels now render above essentially everything else React Flow draws in the canvas, not just their own edge — matching the stated goal ("in front of its own line and ideally anything else it overlaps"), but it does mean a label can now sit visually above unrelated node content it happens to overlap, which wasn't true before for non-elevated edges outside containers. Considered an acceptable, likely desirable trade for a small chip-styled label.
- 5000 is a hand-picked constant, not derived from the actual node/edge zIndex values at runtime. If Canvas.tsx's zIndex scheme changes, this value needs re-checking — the comment next to the CSS rule and this ADR both flag that.
- Verified by reading `getComputedStyle(...).zIndex` back out of the live dev-server DOM (`2000` on a node, `5000` on the label renderer after the change), not by visual/pixel screenshot comparison — screenshotting wasn't reliably available in-session. A quick look at `booking-api-component.chd` in the real app is still worthwhile.

## Addendum (2026-08-24): the predicted staleness happened, silently

The layer-order work ([ADR 0035](0035-layer-order-control.md)) *did* change Canvas.tsx's zIndex scheme exactly as this ADR anticipated (`SHAPE_BASE`/`TEXT_BASE` up to 200,000, and later `SELECTED_EDGE_Z_BOOST` adding 1,000,000 more for a selected edge), but nothing actually revisited this value — the comment's own warning went unactioned across both changes. Real ceiling reached ~1,200,000, `5000` stopped being anywhere close to "comfortably above" it, and edge labels (plus, once it existed, the catmull-rom bend points from edge routing, which share this same portal) silently stopped being clickable whenever their edge carried a high enough z-index — in practice, any *selected* edge, which is exactly the state a user is in right after clicking one to edit its label. Found live-testing edge routing, not the layer-order or selected-edge-color changes themselves — see [known-issues.md](../known-issues.md#react-flowedgelabel-rendereres-z-index-ceiling-went-stale-silently-breaking-edge-labels-and-new-bend-points). Fixed by raising the constant to 2,000,000 and rewriting the comment to name the actual source constants instead of a plain ceiling number, so the next reader has something more specific to re-check than "read three files and do the arithmetic."
