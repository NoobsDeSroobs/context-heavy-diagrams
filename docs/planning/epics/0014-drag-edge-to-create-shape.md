# 0014: Dragging an edge into empty space creates a shape

## Status
Not Started

## Goal
Dragging a connection from a shape's handle and releasing it over empty canvas (instead of onto another node) creates a new shape at the drop point and connects the edge to it. Familiar pattern from Miro/Figma-style tools. Raised during epic 0012 testing, not part of that epic's scope.

## Tasks
- [ ] `onConnectStart`/`onConnectEnd` on `<ReactFlow>`: track which node/handle a connection drag started from
- [ ] On drop, detect whether the release point was the pane background (`event.target` has the `react-flow__pane` class) rather than a valid handle
- [ ] If so: create a new `ShapeNode` at the drop position (via `screenToFlowPosition`), add an edge from the drag's origin handle to it
- [ ] Decide which handle on the new shape the edge attaches to (simplest default: a fixed side, e.g. `left`; revisit if it looks wrong in practice)

## Notes
Only meaningful for `ShapeNode` drags — `TextNode` has no connection handles, so this can never start from a text node.
