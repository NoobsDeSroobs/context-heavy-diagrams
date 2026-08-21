# 0044: Larger, more forgiving resize-handle hit targets

## Status
Not Started — not yet scoped. Raised by the user (2026-08-20): the resize handles on a selected shape/container are only a couple of pixels, making them hard to reliably grab. Deliberately not designed here, just captured so it isn't lost, same as epics 0024/0026/0030/0037-0043. Explicitly told not to build yet.

## Goal
Make grabbing a shape or container's resize handle easier — without necessarily changing how small/unobtrusive the handle looks, just how forgiving it is to actually click.

## Relevant existing behavior
Confirmed by reading the code: `ShapeNode.tsx` and `ContainerNode.tsx` both render `<NodeResizer isVisible={selected} minWidth={...} minHeight={...} />` (`@xyflow/react`) with no `handleStyle`/`handleClassName` override — this is React Flow's own default handle size and hit area, untouched by anything in this app. `TextNode.tsx` also resizes (it's resizable per its own node type) — worth checking whether it uses the same `NodeResizer` and would need the same fix, or has its own handle implementation.

## Real open questions (deliberately not resolved here)
- **Simplest fix: enlarge the hit target without enlarging the visible handle.** A common pattern (small visible dot, larger invisible click/touch area around it) — whether `@xyflow/react`'s `NodeResizer` exposes an easy way to do this (a padding/hit-area prop, or just a bigger handle with the same visual treatment) needs checking against the actual library API before assuming it's simple.
- **The user's own alternate idea: a dedicated "transform mode."** A button or keyboard modifier that, once active, turns a selected shape's whole edges/corners into large, easy-to-hit resize zones — closer to some CAD/design-tool transform-mode conventions than tiny handle dots. A bigger UX change than just enlarging hit targets: needs its own design pass (how you enter/exit the mode, whether it conflicts with normal click-to-move, what it looks like while active).
- **"More aggressively snap to the edge or corner"** — ambiguous which of two different things this means: snapping the *cursor* to the nearest handle (a forgiving-grab aid), or snapping the *resize result* to a grid/alignment guide (which would relate to epic 0011, alignment & snapping, already built, and might mean extending that instead of this). Needs clarifying once this is actually scoped.

## Notes
Not scheduled into the current batch (see [PROGRESS.md](../../../PROGRESS.md)) — flagged here so it's on the backlog and not lost, not because it's next up.

**2026-08-20: possibly the same trigger as [epic 0032](0032-edge-routing-and-waypoints.md)'s edge bias-offset controls.** The user floated reusing whatever "transform mode" key/button gets built here to also put an edge into a draggable-bias-handle state (0032's newly-refined interaction model, itself compared to Bezier control points) — one shared transform key spanning resize handles and edge curve manipulation, rather than two separate modes. Not decided, not designed.
