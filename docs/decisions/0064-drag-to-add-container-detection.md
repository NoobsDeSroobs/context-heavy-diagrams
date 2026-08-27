# 0064: Drag-to-add — container detection without React Flow's own intersection check

## Status
Decided and implemented (2026-08-27).

## Context

Drag-to-add adds a second way to place a Shape/Container/Text/Line onto the canvas — dragging its item-palette button and dropping it — alongside the existing click-to-add. The interesting part was anticipated from the start: "deciding how it interacts with a container under the drop point — presumably drops *into* a container the same way `onNodeDragStop`'s intersection check already handles for existing nodes." That existing check (`onNodeDragStop` in `Canvas.tsx`) calls `rfInstance.getIntersectingNodes(dragged, false)` — React Flow's own bounding-box intersection query — but that function only works on a node React Flow already has registered internally. A node being dragged in from the item palette doesn't exist yet at drop time; it's created by this same drop event.

## Decision

**Container detection is done manually, not via `getIntersectingNodes`.** `addNodeAtPosition` (`Canvas.tsx`) computes each existing top-level/nested container's absolute bounds itself (reusing `absolutePosition`/`boundsFrom`, the same helpers `onNodeDragStop` already uses) and tests **drop-point containment**, not full-rectangle overlap — simpler than replicating `getIntersectingNodes`' AABB-overlap math for a rectangle that doesn't exist as a real node yet, and arguably the more intuitive rule for a drop anyway ("I dropped it here" vs. "the not-yet-real rectangle I would have created happens to overlap this container's edge").

**Tie-break for nested containers: highest `zIndex` wins.** If the drop point falls inside more than one container's bounds (nesting), the new node is parented to whichever renders on top — matching what the user can actually see at that point, not an arbitrary array-order pick.

**The new node is centered under the cursor**, not placed with its top-left corner at the drop point — matches the felt behavior of most drag-and-drop stencil tools (Visio, draw.io) better than a top-left anchor would.

**Click-to-add's four existing `addXNode` callbacks are untouched; `addNodeAtPosition` is a new, separate function with its own near-duplicate node-construction logic per type**, rather than refactoring the four into a shared builder both paths call. Consistent with this codebase's stated preference for a few similar lines over a premature shared abstraction, and lower-risk: the four click-to-add callbacks are already shipped and tested, and this avoids touching them at all.

## Alternatives considered

- **Register the new node with React Flow first (a real `setNodes` call), then run a follow-up `getIntersectingNodes` pass to reparent it** — closer to `onNodeDragStop`'s literal implementation, but needs a second render/effect cycle to work (the node has to actually mount and be measured before `getIntersectingNodes` can see it), and produces a visible two-step "appears, then jumps into the container" instead of landing parented on the first paint. Rejected for that visible glitch.
- **Full bounding-box overlap** (replicating `getIntersectingNodes`' own AABB test against the new node's would-be rectangle) — rejected as unnecessary complexity for a drop interaction, where point containment reads as the more natural rule anyway.
- **A shared node-builder function used by both click-to-add and drag-to-add** — rejected per Decision above; kept as two parallel, independently-simple implementations instead.

## Consequences

- No `.chd` schema change — a dropped node produces exactly the same node shape click-to-add already does (same `data` fields, same default style/metadata seeding), just with a different `position`/`parentId` computation.
- Any future third way to add a node at an explicit point (if one shows up) has a working, self-contained pattern to copy from `addNodeAtPosition` rather than needing to solve the pre-registration intersection problem again from scratch.
