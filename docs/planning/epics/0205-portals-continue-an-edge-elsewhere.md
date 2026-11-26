# 0205: Portals: continue an edge somewhere else

## Status
In progress, on the mock-up (branch `epic/0205-portals`). Logged 2026-11-21 with the maintainer. Leanings below (2026-11-25); mock-up and try first, no design is settled.

## Goal
A complex diagram becomes criss-crossed. A **portal** lets an edge go in at one place and come out at another, so it does not have to run across the diagram and over everything else.

## The idea
- **A portalled edge is still one ordinary edge:** one source, one target, its tags, style, visibility sets and review behaviour, so the two-ended edge model everything is built on stays. It is drawn broken: a short stub leaves the source with a mark and a name, and a matching stub arrives at the target.
- **Leaning (2026-11-25): a portal is an optional property of any edge, not a routing style and not a type.** The edge keeps its routing (straight, step, smooth step, curved), its legend line, markers and animation; only the middle of its route is left undrawn. This replaces the earlier leaning of `routingStyle: "portal"` (2026-11-21), which would have cost an edge its own shape. Stored as an additive field on the edge, such as `portal: { start, end }`, the two places along the path where the visible edge stops and starts again, in pixels from the source; absent means a whole edge. draw.io maps it to a whole edge. `route_edges` and the edge operations of the assistant tools must know the field.
- **The two portals sit close together, where the edge would cross something.** A portal is for skipping a crossing, or an element in the way, when there is no other way: the hidden part is short, and most of the edge stays visible. The mark before the obstacle and the mark after it are the two ends. It is a line jump in the sense that the line skips the crossing, but the line goes in at one mark and comes out at the other, and the numbers say which belong together. (An earlier reading here, with short stubs next to the elements and the edge hidden between them, was wrong.) The nearer the two marks are, the easier the diagram is to read.
- **Setting them:** the two ends are two positions along the path, a slider for each in the edge's panel (as for the label position) and a drag handle for each on the canvas. **Add portals** puts a short gap at the first crossing it finds (the layout check already knows where an edge crosses another edge or an element), or in the middle of the edge when there is none. The ends are clamped so they never swap or touch the elements, and an edge too short for a gap is drawn whole.
- **Matching the two ends: a number, never colour; both marks, by preference** ([ADR 0200](../../decisions/0200-portal-ends-are-matched-by-a-number-and-drawn-as-a-tilde-or-an-oval.md), decided 2026-11-26). At both ends a mark and a number, all portals in one colour. The mark is a tilde (a curved S turned across the edge, like the break in a line) or an oval (the entry oval drawn over the edge so the line goes into it, the exit oval under it so the line comes out of it, which shows the direction); each person picks one in Preferences. The oval's fill and ring colours would be settable (the fill may follow the canvas background). Whatever the mark, the two portals are best kept close to each other. Hovering a badge highlights the other end and the whole edge, and a click on it goes to the other end. How the number is made (from the order in the file, or a name the person types) is open.
- **Ctrl hover and selection** on a portalled edge always show the whole edge, drawn over everything else.
- **draw.io** gets the whole edge, with all its clutter: it has no portals.
- **Portal points, perhaps:** a place that carries a bunch of connections to another place, between the same two points, teleporting many edges at once. To be mocked and checked.

## Not doing
- **Stacked layers of edges:** showing and hiding visibility sets already is that.
- **Line hops** (a small hop where two lines cross): can be sketched as a complement, but the maintainer rarely likes the result.

## Open questions
- Drawing: the mark and the default size of the gap, how the number is chosen (automatic from the order in the file, or typed), and how it reads when there are many.
- Where the gap goes when an element is moved: positions measured from the source drift away from the crossing they skipped (a way to place them again, such as Add portals once more, or anchoring them to what they skip). Where an edge label goes when its position falls in the undrawn middle (leaning: onto the longer stub), and what animation, crossings and the layout check do with the gap (they judge only the drawn parts).
- What the SVG and PNG exports draw: broken like the canvas, or whole like draw.io.
- How a portal point is made, and what it holds.
- Compare, search, the legend, crossings and the assistant tools: what each does with a portalled edge.
- Format: an additive field on the edge, with `docs/file-format.md` changing with it.
- The relay bus of [0065](later/0065-bus-relay-node.md) is a different idea and stays parked; it may turn out to need nothing once portals exist.

## Tasks
- [x] First sheet: [portals-on-a-real-diagram.html](../../experiments/portals-on-a-real-diagram.html), built by `docs/experiments/build-portals-on-a-real-diagram.mjs` from the Meridian Rail landscape of the gallery: six portals cut where edges cross edges or run across elements, drawn with a tilde and with an oval, light and dark, with a zoom. Edges are drawn straight there; still to mock are step and curved edges on it and the other tasks below.
- [x] Second sheet, same page (rebuilt by the same script): straight, step and curved edges on the Meridian Rail landscape, each as it is and with portals cut; toggles for the mark (tilde or oval), the colour (one light blue or one per pair) and the theme, plus a zoom; hovering a mark draws the whole edge dashed; line hops as a sketch; a gap-setting demo (two sliders, clamped, and an Add portals button that cuts at the first crossing); and one reading of a portal point. Not mocked: the drag handles on the canvas, a number typed by the person, how a label moves.
- [x] Look at the sheet and decide the mark and the colour: no colour coding, both marks by preference (ADR 0200). Finding from it, still open: on step and curved edges the crossings pile up along an edge, so the cut grows to 230 to 270 units (on straight edges 76 to 180), against the leaning that the hidden part is short. Either one gap per crossing (several small portals on an edge, which the one `portal: { start, end }` field cannot hold), or accept a longer gap, or only offer Add portals at the first crossing.
- [ ] Decide the gap question above and the other open questions, try it with real diagrams, and write the ADR for the stored field and the gap.
- [ ] Implement: the field, the drawing, the mark preference (tilde or oval), the hover and selection, the exports, the panel, the tools and guidance, `docs/file-format.md`.
- [ ] An example ([ADR 0151](../../decisions/0151-every-visible-feature-has-an-example-diagram.md)) and the changelog.
