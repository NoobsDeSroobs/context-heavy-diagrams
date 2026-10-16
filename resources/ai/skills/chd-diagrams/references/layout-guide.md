# Layout guide: laying out a diagram from scratch

This is about *composition*, not structure — where to put things and what to leave unstyled, when authoring a `.chd` file from a blank canvas with no existing layout to follow. [field-reference.md](field-reference.md) and [authoring-guide.md](authoring-guide.md) tell you how to write a structurally correct file; this tells you how to make a first-draft layout look organized rather than ad hoc — evenly spaced, legibly grouped, not a rainbow of one-off colors.

**These are starting points, not rules the format enforces.** Nothing here is validated by `scripts/validate_chd.mjs` and nothing here overrides field-reference.md if the two ever seem to conflict. A `.chd` diagram is a long-lived document a human keeps opening and hand-adjusting in a real canvas editor for months — once a person has arranged something on purpose, don't "fix" it back toward one of these recipes on a later edit. Use this guide for the first cut of a diagram (or a new section added to one), not as an invariant to defend afterward.

## Do geometry last, after content — not before it

The general flow for creating or modifying a diagram, loosely (this is a shape to reach for, not a rigid recipe to follow lockstep):

1. Create the required shapes and containers.
2. Add the edges, with their labels.
3. Fill in metadata and any other content (tags, icons, details).
4. **Only then**, do a geometry pass: reposition/resize to eliminate overlap and bleeding, uncross edges where reasonably possible, and use empty space well.

The reason step 4 comes last, not first: **an edge's label consumes real visual space that a bounding-box-only layout doesn't account for.** Positioning shapes and routing edges as if a label were free — then adding the label text afterward — routinely leaves the label overlapping the edge itself, a neighboring shape, or another edge's label, even when the shapes and edge paths themselves looked perfectly spaced. (Found 2026-09-05: exactly this, in `examples/gallery/landscape/meridian-rail-landscape-layered/ticketing-and-booking.chd` — edges were positioned and spaced *before* their labels were written, and the spacing stopped making sense once the labels existed.) A label sits at `labelPosition` (default the edge's midpoint, see [field-reference.md](field-reference.md#edge-style)) — when doing the geometry pass, treat that point as needing roughly as much clearance as the label text itself (rough rule of thumb: 100–160px of horizontal breathing room at a typical 12px font, more for a longer label), not just a bare point on a path.

This doesn't mean re-deriving geometry from nothing every time — a small content edit (one more tag, a renamed label) doesn't need a full re-layout. It means: when geometry is actually being decided (a first draft, or a deliberate restructure), decide it after the content that occupies visual space actually exists, not before.

## Base sizes: match the app's own defaults

These are this app's actual default sizes for a freshly created node (what you get from the toolbar with no resize) — reuse them rather than inventing your own, so hand-authored diagrams don't look subtly off from ones built through the UI:

| Node type | Default size |
|---|---|
| Shape (entity) | 120 × 80 |
| Container (grouping) | 320 × 180 — this is only the *empty* default; size a real container to fit its children, see below |
| Text label | 120 × 48 |
| Anchor | 14 × 14 — rarely placed deliberately, normally the result of dragging an edge into empty space |

Deviate freely when a label needs more room or a shape represents something that reads better wider/taller — these are starting sizes, not a constraint.

## Spacing: there is no grid — pick a consistent gap instead

**This format and this app have no grid concept at all** — coordinates are freeform floating-point canvas units, and the app's own snapping is shape-relative (snaps to other shapes' edges/centers within a few pixels while dragging), not grid-based. This was a deliberate choice (this app's ADR 0019, "snap-to-shape, not snap-to-grid") — don't invent a grid unit and don't snap coordinates to some arbitrary multiple. What matters is that *spacing reads as consistent within one diagram*, not that coordinates hit round numbers.

Two gap sizes cover most layouts:

- **Baseline gap — 20px edge-to-edge.** This matches the app's own Align/Distribute feature's default gap. Use it between closely related elements in the same row/column/group (e.g. shapes inside the same container, steps in one pipeline).
- **Loose gap — ~60px edge-to-edge (3× baseline).** Use it between distinct groups or sections — separate layers, separate swimlanes, separate subsystems — so the grouping reads visually even before or without a container drawn around it.

"Edge-to-edge" means clear space between bounding boxes, not anchor-to-anchor distance — measure from one node's `position + size` to the next node's `position`, not center-to-center, otherwise a size mix (e.g. a 320-wide container next to a 120-wide shape) reads as uneven even with a "matching" gap.

**Container sizing has no auto-fit** — this app never resizes a container to hug its children, and there's no stored padding/inset field. When you size a container by hand around its children, leave roughly **24–40px of clear space** between the container's own edge and its nearest child on every side. Remember the coordinate system: a child's `position` is relative to *its container's* top-left corner, not the canvas — so if the container's top-left sits at canvas `(x, y)` and you want 30px of inset, the first child's `position` is `{ x: 30, y: 30 }` regardless of where the container itself sits on the canvas.

## Color and style: restraint, not a fixed palette

This app ships with **no built-in colors** — a freshly created Entity/Container/Text has no `style` object at all until someone sets one (pure CSS default look), and the default style palette starts empty (this app's ADR 0048). There's no house palette to match, so don't invent fixed hex constants and treat them as this app's brand — there isn't one.

What generalizes anyway, as a starting convention for a hand-authored diagram:

- **Omit `style` by default.** An unstyled node isn't a placeholder or an oversight — it's the app's own normal look, and it's what a human draws when they haven't decided a color matters yet. Don't assign every node its own color just because the `style` field exists.
- **One accent color, used sparingly.** If something in the diagram genuinely needs to draw the eye — a critical path, a single point of failure, the one node the user asked to highlight — give *that* element (and only that one, or a small handful) an explicit `style.fill`/`style.stroke`, and leave everything else unstyled. A diagram where every box is a different color has no accent at all.
- **Prefer the `highlights` mechanism over one-off manual coloring** when the goal is "color everything with tag X" rather than "draw attention to this one thing" — it's reusable, toggleable, and doesn't require touching every node's `style` by hand (see [field-reference.md](field-reference.md#highlights)).

## Archetype recipes

Named starting layouts for common diagram shapes. Each is a description plus the coordinate math — not full JSON; see [SKILL.md](../SKILL.md#minimal-worked-example) for a minimal complete file to build on.

### Layered / tiered architecture
Horizontal bands stacked top-to-bottom (presentation → application → data, or similar), each band a Container spanning the full width.

- Stack containers vertically with the **loose gap (60px)** between one container's bottom edge and the next one's top edge, all sharing the same `x` and `width`.
- Inside each container, lay out its shapes left-to-right with the **baseline gap (20px)**, inset **30px** from the container's own edges (per the container-sizing note above).
- Cross-layer edges (a shape in one band connecting to a shape in the band below) usually want `sourceHandle: "bottom"` / `targetHandle: "top"`.

### Hub-and-spoke
One central Entity with several others arranged around it, each connected directly to the hub.

- Place the hub first; place spokes at the four (or eight) compass points around it, each offset by roughly `hub size/2 + baseline gap + spoke size/2` along that axis — e.g. a spoke directly above the hub sits at `hub.x + (hub.width - spoke.width)/2`, `hub.y - spoke.height - 20`.
- With more than ~4 spokes, prefer an evenly-angled ring (simple trig around the hub's center) over cramming everything onto the four cardinal points — pick connection-point sides that face the hub rather than defaulting to the same side for every spoke.

### Request/response pipeline
A left-to-right (or top-to-bottom) sequence of steps, each connected to the next.

- One row of shapes, each **baseline gap (20px)** from the previous one's right edge, all sharing the same `y`.
- `sourceHandle: "right"` / `targetHandle: "left"` on every edge (or `"bottom"`/`"top"` for a vertical pipeline) unless a step branches.
- A return/response path (if drawn as a separate edge rather than implied) usually routes as a second edge between the same two shapes, offset with a couple of manual `points` or a different `routingStyle` so it doesn't overlap the forward-path edge.

### Swimlane
Rows (or columns) by responsibility — one lane per actor/system — with steps placed into whichever lane owns them.

- One Container per lane, full diagram width (or height, for vertical lanes), stacked with the **loose gap (60px)** between lanes, all sharing `x`/`width` (or `y`/`height`).
- Shapes representing a step go inside the lane Container that owns that step, positioned left-to-right (or top-to-bottom) in call order with the **baseline gap** — this is what makes "which lane is this in" read at a glance instead of needing a label lookup.
- Cross-lane edges connect shapes that have different `parentId`s directly by their node `id`s — the format doesn't require same-parent for an edge, only that both endpoint ids exist.

### Boundary / zone nesting
Security zones, trust boundaries, or any "this lives inside that" containment (e.g. a VPC containing subnets containing services).

- Nested Containers, one level of `parentId` per boundary. Each level insets its children by the **24–40px** container margin from the note above, remembering each nesting level's `position` is relative to *its own immediate parent*, not the canvas or the outermost container.
- Don't flatten this into sibling containers with matching colors as a substitute for real nesting — the point of `parentId` nesting here is that "is this inside the boundary" becomes a structural fact (draggable as a unit, filterable by ancestry) rather than just a visual implication.
- An edge crossing a boundary (e.g. external traffic entering a VPC) is a normal edge between two node ids regardless of nesting depth — connect it to the actual entry-point shape, not to the boundary Container itself, unless the diagram genuinely means "traffic enters the zone as a whole" rather than a specific component.
