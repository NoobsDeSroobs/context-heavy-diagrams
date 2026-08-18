# 0002: Resize and rotate

## Status
Done — the one open polish task below is deliberately deferred, not blocking

## Goal
Two custom node types replace the React Flow default: `ShapeNode` (resizable, multiple connection points, never rotatable) and `TextNode` (resizable, rotatable, no connection points). See [docs/decisions/0004-shape-text-node-split.md](../../decisions/0004-shape-text-node-split.md) for why rotation and connection points are mutually exclusive — it's what keeps edges from misattaching on a rotated node.

## Tasks
- [x] `ShapeNode` component: replaces the default node entirely (no `'default'` back-compat alias — breaking early is cheap)
- [x] `NodeResizer` wired up on `ShapeNode` for drag-to-resize, sensible min size
- [x] Multiple connection points (`Handle`s, one per side to start) on `ShapeNode`, `connectionMode={ConnectionMode.Loose}` so any handle can connect to any handle
- [x] `TextNode` component: resizable, no connection points
- [x] Rotation handle + CSS transform on `TextNode`, following React Flow's rotatable-node pattern
- [x] Schema: add optional `size`/`rotation` fields to `DiagramNode`, `sourceHandle`/`targetHandle` on `DiagramEdge` (additive, per ADR 0003), mapped in `toDiagramFile`/`fromDiagramFile`
- [x] Toolbar: separate "Add shape" / "Add text" actions
- [x] Regenerate `examples/hello-world/diagram.json` with `type: "shape"` (was `"default"`)
- [x] Resize and rotate work interactively — rotation was broken (React Flow's own node-drag was intercepting the rotate handle's mousedown; fixed by adding the `nodrag nopan` classes React Flow requires on custom interactive elements inside a node), fixed and confirmed working
- [x] Confirm resize/rotation/handle-connections survive an actual save/load round-trip — confirmed
- [ ] Polish (deferred, not blocking): rotate handle cursor should read as "rotating," not generic `grab`/`grabbing` — CSS has no built-in rotate cursor, needs a custom cursor icon.

Explicitly **not** in this epic (raised during design discussion, routed to their own epics instead): editable double-click labels on shapes/edges ([0012](0012-editable-anchored-labels.md)), user-addable/removable connection points ([0013](0013-configurable-connection-points.md)).

## Notes
Known accepted v1 limitation: `NodeResizer`'s drag math doesn't account for a node's own rotation, so resizing an already-rotated `TextNode` may feel slightly off (drag directions computed in unrotated space). Narrower and lower-stakes than the edge-misattachment risk this epic's design avoids entirely — not worth solving until it's actually reported as annoying in practice.
