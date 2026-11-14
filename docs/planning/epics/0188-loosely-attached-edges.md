# 0188: Edges that attach loosely to their connection points

## Status
Not Started. Logged 2026-11-13; last in the current batch, after [0168](0168-teach-assistants-to-reroute-edges.md) and before v0.10.0. To be revisited (design questions below) when it comes up.

## Goal
Make edges straighter and tidier without the person or an assistant placing every connection point by hand. Both ideas are wanted; neither exists today.

## The two ideas (the maintainer, 2026-11-13)
1. **Springy points.** If the point on the element below is 10px left of the point on the element above, the edge ends move 5px each so the edge runs straight, within limits set by the neighbouring points on the same side and by how much a point may give.
2. **Dynamic attachment.** The edge uses whichever point on the element fits best, and the choice changes as the other element moves round it. A fixed point (the edge is dropped exactly on a connection point) is told apart from a dynamic one (it is dropped on a usually hidden central target, shown while an edge is dragged). It need not be computed while dragging if that is expensive.

When points are added or removed, edges spread out by simple rules (closest, free points first, and so on).

## Where things stand
- An edge with no handle means "let the renderer pick", and the canvas picks the middle of the left side (`resolveEndpointPosition`). That is where dynamic attachment would start; the file format needs no new field for it.
- Points on a side have a clockwise order, and adding or removing a point moves the edges by fixed rules ([ADR 0036](../../decisions/0036-connection-point-count-and-transfer.md)). Dynamic edges would be picked again each time instead.
- The canvas, the SVG and draw.io exports, the layout checks and the assistant tools each work out where an edge ends. Moving that into one shared function comes first.

## Questions to settle first
- Whether a point may slide up to halfway to its neighbours (no setting, order kept, no crossings) or needs its own stiffness setting.
- Whether the handle is drawn where the edge ends, or the edge ends away from the dot.
- How a dynamic edge is shown, and how a person turns a fixed edge dynamic and back.
- Hysteresis for the pick when the other element is almost level; how several dynamic edges to one side are assigned (in order of where their other ends are, so they do not cross).
- What edges with no handle do to existing diagrams, including those an assistant made with `connect` and no handles, and the examples.
- draw.io export: leave dynamic edges unconstrained so draw.io floats them, or write the points they resolve to.

## Tasks
- [ ] One shared pure function for where an edge ends (point, side, direction), used by the canvas, the exports, the layout checks and the edit tools, with no change in behaviour
- [ ] Dynamic attachment: the pick, the hidden central target, fixed against dynamic, the spreading rules, the changelog line, examples
- [ ] Springy points
- [ ] ADR for each of the two once settled; update `docs/file-format.md` if a field is added; example diagrams ([ADR 0151](../../decisions/0151-every-visible-feature-has-an-example-diagram.md))
- [ ] Re-read [0179](0179-align-a-connection-point-with-another-element.md) and [0168](0168-teach-assistants-to-reroute-edges.md) against what this changes (a wide hub with one point per edge, which gave the best picture in the spec comparison of 0177, becomes automatic)
