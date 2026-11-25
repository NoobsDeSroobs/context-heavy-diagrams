# 0205: Portals: continue an edge somewhere else

## Status
Not Started. Logged 2026-11-21 with the maintainer. Leanings below (2026-11-25); mock-up and try first, no design is settled.

## Goal
A complex diagram becomes criss-crossed. A **portal** lets an edge go in at one place and come out at another, so it does not have to run across the diagram and over everything else.

## The idea
- **A portalled edge is still one ordinary edge:** one source, one target, its tags, style, visibility sets and review behaviour, so the two-ended edge model everything is built on stays. It is drawn broken: a short stub leaves the source with a mark and a name, and a matching stub arrives at the target.
- **Leaning (2026-11-25): a portal is an optional property of any edge, not a routing style and not a type.** The edge keeps its routing (straight, step, smooth step, curved), its legend line, markers and animation; only the middle of its route is left undrawn. This replaces the earlier leaning of `routingStyle: "portal"` (2026-11-21), which would have cost an edge its own shape. Stored as an additive field on the edge, such as `portal: { start, end }`, the two stub lengths in pixels; absent means a whole edge. draw.io maps it to a whole edge. `route_edges` and the edge operations of the assistant tools must know the field.
- **The stubs are the real ends of the path.** A stub leaves the source and enters the target the way the edge itself would, so there is nothing to aim, and what a person controls is how much edge stays at each end: a drag handle on each stub along the path, two sliders in the edge's panel (as for the label position), and a button **Add portals** that sets both to a default. Lengths are pixels, not a share of the edge, so a stub keeps its size when an element moves; they are clamped so they never overlap, and an edge too short for two stubs is drawn whole.
- **Matching the two ends: a number does the work, colour is only support.** A numbered badge at both stub ends, which still reads in grayscale, in print and for colour-blind readers. Colour is not the key because it already means something on an edge (a legend line is a colour). To mock both ways and compare: a colour per pair plus the number, and one fixed light blue plus the number. Leaning to the fixed light blue. Hovering a badge highlights the other end and the whole edge, and a click on it goes to the other end. How the number is made (from the order in the file, or a name the person types) is open.
- **Ctrl hover and selection** on a portalled edge always show the whole edge, drawn over everything else.
- **draw.io** gets the whole edge, with all its clutter: it has no portals.
- **Portal points, perhaps:** a place that carries a bunch of connections to another place, between the same two points, teleporting many edges at once. To be mocked and checked.

## Not doing
- **Stacked layers of edges:** showing and hiding visibility sets already is that.
- **Line hops** (a small hop where two lines cross): can be sketched as a complement, but the maintainer rarely likes the result.

## Open questions
- Drawing: the badge and the default stub length, how the number is chosen (automatic from the order in the file, or typed), and how it reads when there are many.
- Where an edge label goes when its position falls in the undrawn middle (leaning: onto the longer stub), and what animation, crossings and the layout check do with the gap (they judge only the drawn parts).
- What the SVG and PNG exports draw: broken like the canvas, or whole like draw.io.
- How a portal point is made, and what it holds.
- Compare, search, the legend, crossings and the assistant tools: what each does with a portalled edge.
- Format: an additive field on the edge, with `docs/file-format.md` changing with it.
- The relay bus of [0065](later/0065-bus-relay-node.md) is a different idea and stays parked; it may turn out to need nothing once portals exist.

## Tasks
- [ ] Mock it on a messy real diagram, on a sheet like `docs/experiments/behaviour-alternatives.html`: the broken edge with its stubs on straight, step and curved edges, the badge as a colour per pair with a number and as one light blue with a number, the Add portals button, the portal point, and line hops as a sketch; light and dark, at canvas size and zoomed out.
- [ ] Try it with real diagrams, decide, and write the ADR.
- [ ] Implement: the field, the drawing, the hover and selection, the exports, the panel, the tools and guidance, `docs/file-format.md`.
- [ ] An example ([ADR 0151](../../decisions/0151-every-visible-feature-has-an-example-diagram.md)) and the changelog.
