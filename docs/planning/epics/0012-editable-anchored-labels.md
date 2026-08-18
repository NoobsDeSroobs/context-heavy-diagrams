# 0012: Editable labels on shapes and edges

## Status
Done

## Goal
Double-click a shape, text node, or edge to write/edit a text label directly on it. Raised during epic 0002 design discussion, deliberately kept out of that epic's scope. Original framing was "positioned relative to an anchor" with a resolved-then-simplified design — see Notes.

## Tasks
- [x] Shape/text labels: double-click swaps the static label for an editable `<input>`, Enter/blur commits to `data.label`, Escape cancels. Closes a real gap — there's currently no in-app way to set a shape's label after creation at all. Built as a shared `EditableLabel` component (`src/renderer/src/components/EditableLabel.tsx`) since node and edge labels both needed the identical behavior.
- [x] `dir="auto"` on every user-authored text field (labels, edge labels) so right-to-left languages render correctly without us tracking direction state ourselves
- [x] `DiagramEdge` gains a `label` field (doesn't exist yet — edges currently carry no text at all) and a `type` field (needed so a custom edge component can be registered, same pattern as `DiagramNode.type`)
- [x] Custom edge component (`EdgeLabelRenderer`, `src/renderer/src/edges/LabeledEdge.tsx`) rendering an editable label at the path's fixed midpoint, double-click to edit, same input-swap pattern as node labels. Label is always rendered (even empty) so there's something to double-click on to add one in the first place.
- [x] Regenerate `examples/hello-world/diagram.json` with the new edge `type`/`label` (also gave the two shapes real labels — "Web App" / "Database" — instead of generic `shape-1`/`shape-2`, more useful as a demo)
- [x] Manual test: double-click editing on shapes, text nodes, and edges; confirm labels survive save/load round-trip — confirmed, plus surfaced two save-flow bugs along the way (both fixed, see notes) and the design discussion that produced ADR 0005. The final save-folder-naming fix wasn't re-verified after its last patch — accepted as-is since the whole folder model it patches is already slated for replacement in epic 0015.

## Notes

**Anchor design, resolved and simplified from the original framing**: shape/text labels are always centered (already true via existing flexbox layout) — no anchor field on `DiagramNode` at all. Freeform 2D label positioning was considered and explicitly rejected: it reintroduces a real UX ambiguity (click-and-drag on a shape already means "move the shape" — a draggable label on top of that is a second, conflicting meaning for the same gesture) that isn't worth taking on without a proven need. If corner-icon collision (epic 0007 puts icons in shape corners) turns out to be a real problem in practice, two options are on the table for later, neither built now: a floating "bias toward top/side/bottom/corner" setting, or freeform movement after all, once there's a real design for resolving the move-shape-vs-move-label conflict.

Edge labels: fixed midpoint only, no drag-along-path for v1 — same reasoning, simplest useful default, add interaction complexity only once it's actually needed.

Text alignment (start/center/end) was floated as a maybe during design discussion but moved to epic [0003](0003-styling-panel.md) instead — it needs a properties panel to actually be reachable, which doesn't exist until that epic.

Interacts with epic [0013](0013-configurable-connection-points.md)'s removal semantics: an edge with a label carries real information, which is exactly why removing a connection point should disconnect rather than delete the edge (see that epic's notes).
