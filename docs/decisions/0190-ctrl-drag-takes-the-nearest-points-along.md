# 0190: Ctrl+drag takes the bend points nearest the dragged element along

## Status
Accepted (2026-11-18)
Amends: [0189](0189-edge-points-move-with-elements-that-move-together.md) (which leaves the points of an edge with one moved end where they are).
Superseded by: none

## Context
When only one end of an edge moves, its manual points stay, so a detour drawn a few pixels off the moved element's wall is left behind. Which points should follow is a judgement: a point that routes round the moved element should, one that routes round the other end should not, and a point that avoids a third element should stay. Any rule that guesses is sometimes wrong, so staying put remains the default.

## Decision
- **Opt in with Ctrl (Cmd on macOS) held when a mouse drag starts.** Without it nothing changes from 0189.
- **Each point is tied to the end whose box it is nearest** (distance to the box, not its centre or corner), and takes the same translation as that end. A point nearer the end that did not move stays; a point equally near both belongs to neither and stays. An edge whose two ends move alike is carried whole, as in 0189, key or no key.
- **Decided once, from the positions when the drag starts,** and kept until it ends, so a point cannot change ends part-way through and the result does not depend on how far the element is dragged.
- **Mouse drags only.** Arrow-key nudges, the alignment panel, typed positions and the assistants' `move` have no moment of "key held at the start" and keep 0189's rule.
- The key is read at drag start and not on every frame; it leaves nothing in the file.

## Alternatives considered
- **Nearest-end as the default:** a silent wrong guess is worse than a visible leftover, and it moves points that were placed to avoid a third element.
- **A blend by distance to the two ends:** a point in the middle of a long edge ends up half-moved, which looks worse than either all or nothing.
- **Anchoring each point to an element:** exact, but a file format change every writer must learn.
- **Right-button drag:** clashes with the context menu.

## Consequences
- On a step edge a single moved point can leave a jog or spike in the right-angled route; the route is drawn as the routing draws it, and it works best with a detour that has points on both sides of the element, or with curves.
- Ctrl+drag is no longer free as the fallback modifier for drag-to-duplicate should a window manager swallow Alt+drag; the two would then need telling apart.
- The shortcuts dialog lists Ctrl+Drag.
