Building a diagram with `edit_diagram` (or `chd edit`). About a page: what you need beyond the tool's own description. For hand-writing the JSON, read the core rules and the field reference instead.

## What the tool does and does not do
- It keeps ids unique, parents before children, paths relative and the file valid. You never write the JSON.
- It places nothing. Every `x` and `y` is yours, **absolute on the canvas, even inside a container** (the tool converts). Sizes: entity 120 × 80, container 320 × 180 (size a real one to fit its contents), text 120 × 48.
- Its answer lists the problems involving what the call touched (label without room, overlap, element sticking out of its container, an edge across an element, crossing edges, a label on something) and how many others remain. It cannot judge alignment, even gaps or grouping: the recipes below are for that.

## Order
1. Decide the grid on paper first: the rows and columns, and the gap each pair of neighbours needs.
2. Ask `room_for_label` (or `chd ask room`) for each edge that has a label, with its direction and font, and take `target` as the gap. Do not use the plain gaps for elements joined by an edge.
3. One call per section (a container and what is in it, then the edges), not one per element. Containers first, then their children with `parent`, then `connect`. Pass the fingerprint of the last answer as `base_fingerprint`.
4. Read the problems in the answer and fix them with `move` and `resize` in the next call. A crossing is sometimes the clearest drawing: keep it and say so.
5. Tags, links and notes last. At the end, `inspect_diagram` with `issues_only` shows everything still open.

## Numbers
- Elements in a group, not joined by an edge: **20px** apart. Distinct groups or layers: **60px**.
- Inside a container: **24–40px** (use 30) from its edge to its nearest child on every side. A container does not grow by itself.
- Joined by an edge: the gap from `room_for_label`. Without it, horizontal `6.5 × characters + 50`, vertical 63 for a one-line label, 40 with no label.
- Several edges leaving one element (a gateway to four services): make that element wide, add a connection point for each edge (`add_connection_point`) so every edge leaves from its own point and runs straight, and put the targets more than a label chip apart (`room_for_label` gives the chip width; add 20px). Never let several edges share one point, and do not patch collisions with `labelPosition` afterwards.
- Size boxes to their job: a hub or a bus is a wide bar, not another 120 × 80 box. Boxes joined by an edge go next to each other in the flow, not with a third box between them, so edges stay short and evenly spaced.
- An edge should not cross a container it does not start or end in. Straight is the default; bend an edge only when a straight one cannot be had. Mirror the layout where the structure is symmetrical.
- Keep an edge label off container titles and container walls (the answer reports both). Put the label (`labelPosition`) where there is room, usually inside the container rather than in the narrow gap between an outside box and the wall.
- Measure gaps between boxes (`x + width` to the next `x`), not between centres.
- Leave `style` out unless one element must stand out. Use highlights for colour by tag.

## Recipes
- **Layers:** one full-width container per band, same `x` and `width`, 60px apart; entities left to right inside, 30px in. Edges between bands: `bottom` to `top`; in any vertical run pick `bottom` and `top`, not the sides.
- **Hub and spoke:** hub first, spokes at the compass points (a ring beyond four), each the connection gap away, with connection points facing the hub.
- **Pipeline:** one row, same `y`, each step a connection gap from the last; `right` to `left`.
- **Swimlane:** one container per lane, same `x` and `width`, 60px apart; each step in its lane in call order.
- **Boundary nesting:** a container per level, each inset 30px from its parent. Connect edges to the component, not to the boundary.

Once a person has arranged something on purpose, do not move it back toward a recipe.
