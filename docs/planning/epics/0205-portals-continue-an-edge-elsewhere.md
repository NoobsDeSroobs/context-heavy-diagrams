# 0205: Portals: continue an edge somewhere else

## Status
Not Started. Logged 2026-11-21 with the maintainer. Mock-up and try first; no design is settled.

## Goal
A complex diagram becomes criss-crossed. A **portal** lets an edge go in at one place and come out at another, so it does not have to run across the diagram and over everything else.

## The idea
- **A portalled edge is still one ordinary edge:** one source, one target, its tags, style, visibility sets and review behaviour, so the two-ended edge model everything is built on stays. It is drawn broken: a short stub leaves the source with a mark and a name, and a matching stub arrives at the target.
- **Leaning (2026-11-21): a portal is a routing style,** in the same dropdown as straight, step, smooth step and curved, stored as `routingStyle: "portal"` with a few optional fields (the name, the stub length). No new concept in the panel; draw.io maps it to a straight edge. The cost is that a routing style replaces the path shape, so a portal cannot also be a stepped line; with the straight stub below that is fine for a first version. `route_edges` and the edge operations of the assistant tools must know the value, and the mock-up should show what the default edge style does with it.
- **First leaning: each portal is part of a straight line.** The first part of the line can then be aimed, and shows where it would go.
- **Ctrl hover and selection** on a portalled edge always show the whole edge, drawn over everything else.
- **draw.io** gets the whole edge, with all its clutter: it has no portals.
- **Portal points, perhaps:** a place that carries a bunch of connections to another place, between the same two points, teleporting many edges at once. To be mocked and checked.

## Not doing
- **Stacked layers of edges:** showing and hiding visibility sets already is that.
- **Line hops** (a small hop where two lines cross): can be sketched as a complement, but the maintainer rarely likes the result.

## Open questions
- Drawing: the stub's length and mark, how the name is chosen (automatic letters?), how a person aims one, and how it reads when there are many.
- What the SVG and PNG exports draw: broken like the canvas, or whole like draw.io.
- How a portal point is made, and what it holds.
- Compare, search, the legend, crossings and the assistant tools: what each does with a portalled edge.
- Format: an additive field on the edge, with `docs/file-format.md` changing with it.
- The relay bus of [0065](later/0065-bus-relay-node.md) is a different idea and stays parked; it may turn out to need nothing once portals exist.

## Tasks
- [ ] Mock it on a messy real diagram, on a sheet like `docs/experiments/behaviour-alternatives.html`: the broken edge with a straight stub, the portal point, and line hops as a sketch; light and dark, at canvas size and zoomed out.
- [ ] Try it with real diagrams, decide, and write the ADR.
- [ ] Implement: the field, the drawing, the hover and selection, the exports, the panel, the tools and guidance, `docs/file-format.md`.
- [ ] An example ([ADR 0151](../../decisions/0151-every-visible-feature-has-an-example-diagram.md)) and the changelog.
