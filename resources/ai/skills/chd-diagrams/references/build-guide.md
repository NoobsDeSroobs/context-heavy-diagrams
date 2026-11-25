Building a diagram with `edit_diagram` (or `chd edit`). About a page: what you need beyond the tool's own description. For hand-writing the JSON, read the core rules and the field reference instead.

## What the tool does and does not do
- It makes every id and keeps the file valid; you never write the JSON. To use something later in the same call, give it a handle (`"as": "$web"`); in the next call use the ids from the answer.
- It places no element. Every `x` and `y` is yours, **absolute on the canvas, even inside a container** (the tool converts). Sizes: entity 120 × 80, container 320 × 180 (size a real one to fit its contents), text 120 × 48.
- Its answer lists the problems involving what the call touched (label without room, overlap, an element out of its container, an edge across an element, crossing edges, a label on something) and how many others remain. It cannot judge alignment, even gaps or grouping: the recipes below are for that.

## Order
1. Decide the grid on paper first: the rows and columns, and the gap each pair of neighbours needs.
2. Ask `room_for_label` (or `chd ask room`) for each edge that has a label, with its direction and font, and take `target` as the gap. Do not use the plain gaps for elements joined by an edge.
3. One call per section (a container and what is in it, then the edges), not one per element. Containers first, then their children with `parent: "$zone"`, then `connect`. Pass the last answer's fingerprint as `base_fingerprint` and send calls one at a time: a second call with the same fingerprint fails.
4. Fix the problems in the answer with `move` and `resize` in the next call. For an edge across an element, move the element or the edge's connection point; if that cannot be done, `route_edges` (the reported edges, or `ids`) routes it at right angles through the gaps, so leave gaps (20-60px). It puts each routed edge on a connection point of its own, in order along the side facing its other end: do not add points for those edges. A crossing is sometimes the clearest drawing: keep it and say so.
5. Tags, links and notes last. At the end, `inspect_diagram` with `issues_only` shows everything still open.

## Flows: behaviours
A behaviour is what happens in a flow (step, decision, parallel, start, end); a thing in the system is an entity. `add_behaviour {kind, label?, x, y, parent?}`: the kind sets the size and the default label, so omit them. Use `step` unless a person (`step-human`), a machine (`step-automatic`), a nested flow (`step-sub-flow`) or a repetition (`step-repeat`) matters; `branch-exclusive` is a decision, `branch-inclusive` one or more ways, `branch-parallel` runs paths side by side, `branch-all` waits for all of them, `branch-one` for the first (close a decision with a decision kind); events: `event-start`, `event-end`, `event-timer`, `event-message`, `event-human`, `event`; ends have `outcome`/`reach`, events `flowPosition`. `set_behaviour_kind` changes the kind; every other operation works as on an entity, but it has a link and no tags or note.
- A lane is a container and a behaviour in it has it as `parent`. `inspect_diagram` gives an edge that crosses a lane's border a `crossing` ("Sales → Finance"), a hand-off: information, not a problem.
- The small shapes (branches, events) carry their label outside: `labelPosition` below (default), above, left, right or free, set on `add_behaviour` or with `set_label_position`; put it away from the edges that leave the shape. `set_label_position` also takes a container side (top, left, right, bottom).

## Numbers
- Elements in a group, not joined by an edge: **20px** apart. Distinct groups or layers: **60px**.
- Inside a container: **24–40px** (use 30) from its edge to its nearest child on every side. A container does not grow by itself.
- Joined by an edge: the gap from `room_for_label`. Without it, horizontal `6.5 × characters + 50`, vertical 63 for a one-line label, 40 with no label.
- Several edges leaving one element (a gateway to four services): make it wide and add a connection point for each edge (`add_connection_point`), in the order of the targets along the side (a side's points are spread evenly; do not try to line one up with a target). Put the targets more than a label chip apart (`room_for_label` gives the width; add 20px). Never let edges share a point, and do not patch collisions with `labelPosition` afterwards.
- Size boxes to their job: a hub or a bus is a wide bar, not another 120 × 80 box. Boxes joined by an edge go next to each other in the flow, not with a third box between them, so edges stay short and evenly spaced.
- An edge should not cross a container it does not start or end in. Straight is the default; bend an edge only when a straight one cannot be had. Mirror the layout where the structure is symmetrical.
- Keep an edge label off container titles and container walls (the answer reports both). Put the label (`labelPosition`) where there is room, usually inside the container rather than in the narrow gap between an outside box and the wall.
- Measure gaps between boxes (`x + width` to the next `x`), not between centres.
- Leave `style` out unless one element must stand out, or the diagram is complex and busy: then use style to increase the differences between aspects (a heavier container border so containers read apart from edges, different weights and colours for different kinds of element or edge). Use highlights for colour by tag.

## Recipes
- **Layers:** one full-width container per band, same `x` and `width`, 60px apart; entities left to right inside, 30px in. Edges between bands: `bottom` to `top`; in any vertical run pick `bottom` and `top`, not the sides.
- **Hub and spoke:** hub first, spokes at the compass points (a ring beyond four), each the connection gap away, with connection points facing the hub.
- **Pipeline:** one row, same `y`, each step a connection gap from the last; `right` to `left`.
- **Swimlane:** one container per lane, same `x` and `width`, 60px apart; each step (a behaviour) in its lane in call order. A lane's title on its left (`labelPosition: "left"` on `add_container`) takes about 24px across: 30px from the edge to the children is enough.
- **Boundary nesting:** a container per level, each inset 30px from its parent. Connect edges to the component, not to the boundary.

Once a person has arranged something on purpose, do not move it back toward a recipe.
