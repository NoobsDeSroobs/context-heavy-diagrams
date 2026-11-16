# 0189: Where a label goes

## Status
Not Started. Logged 2026-11-16, from using Behaviour in flows.

## Goal
Let a person choose where an element's label sits, so it does not cover an edge: on the small shapes of [Behaviour](0105-semantic-notation-stencils.md) (start, end, events, choices) and on containers.

## Tasks
- [ ] Small shapes: a label position of below (today), above, left, right or free. Free puts the label anywhere, tied to its shape by a dotted line once it is not touching. Stored per element (a position and, for free, an offset from the shape); additive in `docs/file-format.md`.
- [ ] Containers: a label on any side (top, as now, left, right, bottom). Left and right probably turned 90° as in a swim lane; to decide.
- [ ] The canvas, the SVG, PNG and draw.io exports, the layout check (label room, label on an edge) and the compare view all use the same position; the layout check can name a side that is free.
- [ ] Property panel and a handle on the canvas to drag a free label; the assistant tools take the position as a field.
- [ ] An ADR; an example diagram that shows each position.

## Notes
- A free label that moves with its shape and a dotted leader line cost nothing when the label is close, so the line is drawn only when there is a gap.
- Containers matter for lanes: a vertical lane wants its name on the left, turned. That makes this a companion of the lane hand-off check ([0088](later/0088-cross-container-edge-detection.md)).
- An automatic position (the app picks the side with no edge on it) was considered: it spares the work but moves labels when an edge is added, and the file would not say where the label is. An explicit position with a free choice is more predictable; the layout check can suggest one.
