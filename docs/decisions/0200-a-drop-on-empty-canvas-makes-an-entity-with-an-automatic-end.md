# 0200: A drop on empty canvas makes an entity with an automatic end

## Status
Accepted (2026-11-26)
Supersedes: the last sentence of the "Making one" point in [0178](0178-edge-ends-with-no-connection-point-attach-themselves.md) (a drop on empty canvas makes an entity "with a fixed end") and the left-point attachment in [0107](0107-remove-anchor-placeholder-node.md).
Superseded by: none

## Context
Dropping a dragged edge on empty canvas makes an entity there and ends the edge at it. The end was fixed to the entity's left point, whichever side the entity was dropped on, so an edge to an entity dropped to the right of its origin ran round the entity to reach the left side, and the person had to move it. Since [0178](0178-edge-ends-with-no-connection-point-attach-themselves.md) an end can name no point and attach itself to the side that faces the other element, which is what a person would pick.

## Decision
- **The new entity's end is automatic.** Both when a new edge is dragged from an element and when the end of an existing edge is dragged loose: the loose end moves to the new entity and names no connection point.
- **The other end is untouched.** The end that was dragged from, or that stayed put in a reconnect, keeps its point, or stays automatic if it was.
- **Nothing else changes:** the entity is made as before, opens straight into label editing, and shares one undo step with the edge.

## Alternatives considered
- **Keep the left point.** It is only a default, wrong for three drops out of four, and the person has to fix it by hand each time.
- **Make both ends automatic.** The end the person dragged from, or left in place, was placed on purpose ([0178](0178-edge-ends-with-no-connection-point-attach-themselves.md)).
- **Pick the side at the drop and store it.** A stored point does not follow the entity when it is moved; the automatic end does, and needs nothing stored.

## Consequences
- The new end moves with the entity. **Fix to current points** (right-click the edge) makes it fixed if the person wants it to stay.
- Files are unchanged in format: the new end has no handle, which the format already allows.
