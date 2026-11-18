# 0189: Edge points move with elements that move together

## Status
Accepted (2026-11-18)
Amends: [0057](0057-edge-routing-style.md) and [0077](0077-orthogonal-edge-segment-dragging.md) (the points stay absolute canvas positions; this says when they are moved for the person).
Superseded by: none

## Context
An edge's manual points are absolute canvas positions, so moving elements left them behind. Moving a container with a loop drawn round two of its children cut the loop through them.

## Decision
- **When both ends of an edge move by the same amount, its points move by that amount.** "Move" means the element's position on the canvas changed, whatever the reason: a drag, a container drag, a multi-selection, the arrow keys, the alignment panel, a typed position, an assistant's `move`. A container's children move with it, so every edge between them is carried; an edge from an element to itself is carried when that element moves.
- **Anything else leaves the points where they are:** one end moving, the ends moving by different amounts, a resize (including a group resize), a reparent that keeps the element in place, and a change of the edges in the same step (undo, redo, opening a file, paste), which restores points as saved.
- **No new data and no key.** The points stay absolute; the file format is unchanged and a reader that knows nothing of this still draws the diagram right. A diagram edited by hand or by another tool is not touched.
- **One rule in one place:** `src/shared/edges/carryPoints.ts` compares the absolute positions of the nodes before and after and gives the shift of an edge whose two ends shifted alike. The editor applies it after any render that changed positions and not edges (`useCarryEdgePoints`), so it follows the nodes, not the gestures; the assistant operations apply it to `move`. It is one undo step with the move that caused it.

## Alternatives considered
- **Carrying in each gesture** (drag, nudge, align): three or more places to keep in step, and a new way to move would forget. Watching the nodes covers them all, and a path that changes the edges too is skipped, which fails safe.
- **Anchoring each point to an element, or storing points relative to the ends:** exact for a move of one end, but a file format change that every writer must learn. Not needed for the case where both ends move.

## Consequences
- An edge whose one end moves still keeps its points. Letting the points nearest the moved end follow is not covered here.
- A moved container no longer needs its inner loops fixed by hand.
