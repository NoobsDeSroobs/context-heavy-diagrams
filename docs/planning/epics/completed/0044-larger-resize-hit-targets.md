# 0044: Larger, more forgiving resize-handle hit targets

## Status
Done (2026-08-22). Raised by the user (2026-08-20): the resize handles on a selected shape/container are only a couple of pixels, making them hard to reliably grab. "Explicitly told not to build yet" at capture time — held until the Canvas batch group reached it in sequence.

## Goal
Make grabbing a shape or container's resize handle easier — without necessarily changing how small/unobtrusive the handle looks, just how forgiving it is to actually click.

## Relevant existing behavior
Confirmed by reading the code: `ShapeNode.tsx` and `ContainerNode.tsx` both render `<NodeResizer isVisible={selected} minWidth={...} minHeight={...} />` (`@xyflow/react`) with no `handleStyle`/`handleClassName` override — this is React Flow's own default handle size and hit area, untouched by anything in this app. `TextNode.tsx` also resizes (it's resizable per its own node type) — worth checking whether it uses the same `NodeResizer` and would need the same fix, or has its own handle implementation.

## Real open questions (deliberately not resolved here)
- **Simplest fix: enlarge the hit target without enlarging the visible handle.** A common pattern (small visible dot, larger invisible click/touch area around it) — whether `@xyflow/react`'s `NodeResizer` exposes an easy way to do this (a padding/hit-area prop, or just a bigger handle with the same visual treatment) needs checking against the actual library API before assuming it's simple.
- **The user's own alternate idea: a dedicated "transform mode."** A button or keyboard modifier that, once active, turns a selected shape's whole edges/corners into large, easy-to-hit resize zones — closer to some CAD/design-tool transform-mode conventions than tiny handle dots. A bigger UX change than just enlarging hit targets: needs its own design pass (how you enter/exit the mode, whether it conflicts with normal click-to-move, what it looks like while active).
- **"More aggressively snap to the edge or corner"** — ambiguous which of two different things this means: snapping the *cursor* to the nearest handle (a forgiving-grab aid), or snapping the *resize result* to a grid/alignment guide (which would relate to epic 0011, alignment & snapping, already built, and might mean extending that instead of this). Needs clarifying once this is actually scoped.

## What was built
See [ADR 0038](../../../decisions/0038-resize-handle-hit-target-size.md) for the full reasoning. Answers to the real open questions above:
- **Simplest fix**: built, but split by element type rather than one uniform treatment — a corner handle's hit area and its visible dot are the same DOM element (no separable padding trick possible there), so it was grown outright, 5x5px to 10x10px, same tradeoff already worked through once on epic 0046's edge reconnect points. An edge line's grab corridor turned out to be a genuinely free improvement — it's a separate invisible box from the always-thin visible border, widened from 1px to 8px with zero visual change.
- **Transform mode**: deferred, not designed — real scope of its own, and possibly shared with epic 0032 per the note below.
- **More aggressive snapping**: deferred, out of scope for this pass.

Implementation is CSS-only (`src/renderer/src/assets/main.css`, scoped under `.canvas-view-flow` for specificity) — no component changes, confirmed by reading the code that `ShapeNode`/`ContainerNode`/`TextNode` all already share the same unstyled `<NodeResizer>`, so one fix covers all three.

## Verification
Clean typecheck. Verified structurally in the running dev server (a shape added, selected, and the actual rendered resize-control elements' computed styles read via JavaScript) rather than a screenshot — the Browser pane's screenshot compositing was unavailable again this session (same limitation as several prior epics). Confirmed: all 4 corner handles render at 10x10px/2px radius, all 4 edge lines at 8px hit-corridor thickness while their visible border stays exactly 1px, on the actual live DOM, not just computed in isolation. Purely a sizing change with no event-handling code touched, so regression risk to the underlying drag mechanics themselves is low — still worth a quick look at how the new handle size actually feels/looks in practice.

## Notes
**2026-08-20: possibly the same trigger as [epic 0032](0032-edge-routing-and-waypoints.md)'s edge bias-offset controls.** The user floated reusing whatever "transform mode" key/button gets built here to also put an edge into a draggable-bias-handle state (0032's newly-refined interaction model, itself compared to Bezier control points) — one shared transform key spanning resize handles and edge curve manipulation, rather than two separate modes. Not decided, not designed — still applies now that this epic's simpler sizing fix is done; "transform mode" itself remains unbuilt.
