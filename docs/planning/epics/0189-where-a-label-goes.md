# 0189: Where a label goes

## Status
In Progress. Logged 2026-11-16, from using Behaviour in flows. The small shapes are done; the containers go with the lane hand-off check.

## Goal
Let a person choose where an element's label sits, so it does not cover an edge: on the small shapes of [Behaviour](0105-semantic-notation-stencils.md) (start, end, events, choices) and on containers.

## Tasks
- [x] Small shapes ([ADR 0183](../../decisions/0183-where-the-label-of-a-small-shape-goes.md)): a label position of below (today), above, left, right or free. Free puts the label anywhere, tied to its shape by a dotted line once it is not touching. Stored per element (a position and, for free, an offset from the shape); additive in `docs/file-format.md`.
- [x] Containers ([ADR 0184](../../decisions/0184-the-label-of-a-container-goes-on-any-side.md)): a label on any side (top, as before, left, right, bottom), the top of the text pointing at the side, the bottom upright; lined up along it by the text alignment. Still to do: a header band for a lane, if wanted.
- [x] The canvas, the SVG, PNG and draw.io exports and the compare view use the same position (a free label goes to draw.io below, with a note). Still to do: the layout check naming a side that is free.
- [x] Property panel, and dragging a free label on the canvas. Still to do: the assistant tools take the position as a field, with the other tool work for Behaviour.
- [x] An ADR and an example diagram that shows each position (`examples/label-positions.chd`).

## Notes
- A free label that moves with its shape and a dotted leader line cost nothing when the label is close, so the line is drawn only when there is a gap.
- Containers matter for lanes: a vertical lane wants its name on the left, turned. That makes this a companion of the lane hand-off check ([0088](0088-cross-container-edge-detection.md)).
- An automatic position (the app picks the side with no edge on it) was considered: it spares the work but moves labels when an edge is added, and the file would not say where the label is. An explicit position with a free choice is more predictable; the layout check can suggest one.
