# 0032: Edge routing and waypoints

## Status
Not Started — not yet scoped, needs a real design conversation before implementing

## Goal
A way to control how an edge routes between its two ends, so it can be steered around other shapes/containers it would otherwise cross straight through. Raised during epic 0014 (drag-edge-to-create-shape) testing — unrelated to that epic's own scope (creating a new shape from a drag), just surfaced by the same session of poking at edges.

Currently every edge is a single path computed straight from source handle to target handle (`LabeledEdge.tsx`) — no way to add a bend, and no way to avoid overlapping a node that happens to sit between two connected shapes.

## Open questions (not resolved here)
- **Interaction model.** The user's own leaning going in: mid-edge points the edge is forced to pass through, with "vector controls" (i.e. draggable waypoint handles on the edge itself, maybe with direction/tangent handles too, not just a plain point) — closer to a vector-path-editing feel than, say, orthogonal auto-routing. Worth comparing against how other diagramming tools (Visio, draw.io, Miro) handle this before settling on a specific interaction, since "waypoints with vector controls" could mean several different things in practice (plain draggable points that just bend a straight/curved line through them, vs. full Bezier handles per point).
- **Manual placement vs. auto-avoidance.** Does the user place waypoints by hand only, or does the tool ever suggest/auto-route around an obstacle? The framing above ("route them around other objects") suggests manual control is the actual ask, not automatic obstacle avoidance — but worth confirming explicitly rather than assuming, since automatic routing is a substantially bigger feature.
- **Data model.** Waypoints need to live somewhere in `DiagramEdge` (`src/shared/diagram.ts`) — likely an ordered array of points (canvas coordinates, or relative to the source/target the way `ConnectionPoint.offset` is relative to its side) — and `docs/file-format.md` needs to document whatever shape is chosen. Whether a waypoint is a plain `{x, y}` or carries its own tangent/control-point data depends on the interaction model question above.
- **Rendering.** `LabeledEdge.tsx` currently uses one of React Flow's built-in path helpers end-to-end; routing through waypoints means building the path manually (piecewise, one segment per waypoint) instead.
- **Relationship to epic 0014's AnchorNode.** Epic 0014 added a small placeholder node type (`AnchorNode`, see [epic 0014](0014-drag-edge-to-create-shape.md)) as the "leave the edge in space" outcome of a drag that isn't resolved into a real shape yet. That's a real *node* in the graph (draggable, its own id, persisted like any other node) — conceptually adjacent to "a point an edge passes through" but not the same thing (a waypoint doesn't need its own connection handles, icons, or the option to later become a Shape/Container). Worth deciding explicitly whether waypoints reuse/extend that concept or are a fully separate mechanism, rather than accidentally ending up with two unrelated ways to put a point on the canvas.

## Notes
No target position in the epic sequence — flagged so it isn't lost, not because it's next up. See [PROGRESS.md](../../../PROGRESS.md) for what's actually scheduled.
