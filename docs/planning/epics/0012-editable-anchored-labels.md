# 0012: Editable anchored labels on shapes and edges

## Status
Not Started

## Goal
Double-click a shape or an edge (arrow) to write/edit a text label directly on it, positioned relative to an anchor point — default center for shapes, default midpoint for edges. Raised during epic 0002 (resize/rotate) design discussion but deliberately not part of that epic's scope.

## Tasks
- [ ] Open design question (unresolved): is "anchor" a small set of preset positions (center + sides/corners, matching the brief's per-corner icon-slot language) or a freely draggable point? Needs deciding before implementation.
- [ ] Shape labels: double-click enters edit mode (swap static label for an editable field), Enter/blur commits to `data.label`. Closes a real gap — there's currently no in-app way to set a shape's label after creation at all.
- [ ] Edge labels: custom edge component using React Flow's `EdgeLabelRenderer`, label positioned at the anchor point along the path (default midpoint). Not supported by React Flow's default edge types out of the box.
- [ ] Schema: label anchor field(s) on `DiagramNode`/`DiagramEdge`, additive per ADR 0003
- [ ] `DiagramEdge` needs a `label` field (doesn't exist yet — edges currently carry no text at all)

## Notes
Interacts with epic [0013](0013-configurable-connection-points.md)'s removal semantics: an edge with a label carries real information, which is exactly why removing a connection point should disconnect rather than delete the edge (see that epic's notes).
