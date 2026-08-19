# 0011: Alignment and snapping

## Status
Not Started

## Goal
Accurately align shapes vertically/horizontally while dragging, with snapping — requested during epic 0002 design discussion, not part of the original brief. Numeric position/size fields already exist on every node; this epic is about mouse-driven precision on top of that, since direct mouse interaction is the primary way shapes actually get positioned.

## Tasks
(Not broken down yet — revisit when this epic starts.)
- [ ] Visual alignment guides (snap lines) when a dragged node's edges/center line up with another node's
- [ ] Snap-to-alignment while dragging (within some threshold)
- [ ] Decide if snap-to-grid is also wanted, independent of snap-to-shape
- [ ] Connection-aware alignment: position a node relative to its connected neighbor(s) — e.g. a node with one incoming/outgoing edge aligns on the same axis as what it's connected to, rather than sitting wherever it happened to land. Raised as a QoL idea for as diagrams grow more complex; genuinely undecided whether this means lightweight drag-time snapping against connected nodes specifically (extending the tasks above with "connected" as another alignment source, not just "nearby") or something closer to real graph auto-layout (e.g. a dagre/elk-style algorithm repositioning based on the whole connection graph) — a real design decision to make when this epic starts, not a small addition to assume away.

## Notes
No target position in the epic sequence yet — flagged as "at some point," not urgent relative to 0002–0010.
