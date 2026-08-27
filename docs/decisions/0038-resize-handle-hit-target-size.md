# 0038: Resize handle hit-target sizing

## Status
Accepted

## Context
Raised (2026-08-20): the resize handles on a selected shape/container/text node are only a few pixels, hard to reliably grab. Left deliberately unscoped at capture time, with three real open questions and a note saying "explicitly told not to build yet" — that held until the Canvas batch group reached it in sequence (2026-08-22).

## Decision
- **Scope: just the hit-target sizing.** The other two open questions — a dedicated "transform mode" (a real UX-mode design of its own, possibly sharing a mechanism with edge routing's bend handles) and "more aggressive snapping" (ambiguous between cursor-snap-to-handle and resize-result-snap-to-grid or snap-to-shape) — are deferred, not designed further here.
- **Corner handles and edge lines get different treatment**, because they're structurally different in React Flow's own implementation:
  - A corner **handle** is one `<div>` that is simultaneously the visible dot and the entire hit target — there's no way to enlarge the grab area without enlarging the dot itself. Grown from the library default 5×5px to 10×10px (border-radius scaled to match, same proportions as the default). This is the same tradeoff the edge-reconnection work already went through for edge reconnect points — tried a smaller-visible/larger-invisible split there first, walked it back after live testing felt like an approximation, and landed on "the visible size is the real grab size." Same call here, on purpose, rather than re-litigating it.
  - An edge **line** (drag anywhere along a side, not just a corner) is a separate box from the always-1px visible border the library draws inside it — widening the box (invisible grab corridor) doesn't thicken the visible line at all. Free improvement: grown from a 1px-wide corridor to 8px.
- **CSS-only, scoped under `.canvas-view-flow`** rather than via `handleStyle`/`lineStyle` props on `<NodeResizer>`. A single `lineStyle` object can't set both dimensions safely (the "wrong" axis for a given side is otherwise driven by the library's own 100%-width/height rule, which an inline style would override and break), so this needed real CSS selectors per side anyway — same file/pattern as the existing `.react-flow__edgeupdater` override from the edge-reconnection work. Scoped with an extra ancestor class (3-class specificity vs. the library's own 2-class rules) rather than relying on CSS bundle import order, so it wins regardless of how Vite orders the final stylesheet.
- **One shared fix covers all three resizable node types** (`ShapeNode`, `ContainerNode`, `TextNode`) — confirmed by reading the code that all three already render the exact same unstyled `<NodeResizer>`, not separate implementations, so there was never a need to touch each individually.

## Alternatives considered
- **Small visible dot, larger invisible hit padding around it** (the epic doc's own "simplest fix" framing) — the natural first instinct, and genuinely free for the edge lines (built that way). For corner handles specifically, rejected for the reason above: the handle div has no separable visible/hit-area concept, and this exact tradeoff was already tried and reversed once on this project (the edge-reconnection work) — no reason to reintroduce it here.
- **Building the "transform mode" now** instead of a simple size bump. Rejected — real scope of its own (entry/exit gesture, conflict with normal click-to-move, and a plausible shared mechanism with edge routing's bend handles that hasn't been designed yet), and the simple sizing fix likely resolves most of the reported friction on its own.

## Consequences
- `src/renderer/src/assets/main.css` gains the `.canvas-view-flow .react-flow__resize-control...` rules; no component code changes anywhere — `ShapeNode.tsx`/`ContainerNode.tsx`/`TextNode.tsx`'s `<NodeResizer>` usages are untouched.
- Purely visual/hit-area sizing — no schema, no new state, nothing to persist.
- If "transform mode" or "more aggressive snapping" get picked up later (possibly alongside edge routing), this ADR's Decision section is the right place to check first for what was already ruled out and why.
