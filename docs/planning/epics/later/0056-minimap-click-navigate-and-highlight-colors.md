# 0056: Minimap click-to-navigate, and highlight colors on the minimap

## Status
Not Started — not yet scoped. Raised by the user (2026-08-22). Deliberately not designed here, just captured so it isn't lost, same as epics 0024/0026/0030/0037/0038/0048/0055 before their own design passes. **Explicitly told to log this for later, not build it now.**

## Goal
Two related minimap improvements:
1. Click (or drag) somewhere on the minimap to actually navigate the canvas there.
2. Show the diagram's active highlight colors on the minimap's own node representations too, not just on the real canvas.

## Relevant existing behavior
`Canvas.tsx` renders a bare `<MiniMap />` (React Flow's own built-in component) with no props set — every customization option is at its library default.

Checked React Flow's own `MiniMapProps` (`@xyflow/react`) before logging this, since both asks map directly onto existing props rather than needing custom-built interaction:
- **Click-to-navigate**: `pannable` (drag-to-pan the viewport from inside the minimap) and `zoomable` (scroll-to-zoom from inside the minimap) both exist and both default to `false`. There's also a plain `onClick` callback (`(event, position) => void`) if a straight jump-to-click, rather than drag-panning, is what's actually wanted — worth deciding which interaction model fits before just flipping `pannable` on.
- **Highlight colors on the minimap**: `nodeColor` accepts either a flat color string or a per-node function `(node) => string`. This app already has `matchHighlights(metadata)` (via `DiagramContext`) computing exactly this for the real canvas (`ShapeNode`/`ContainerNode`'s own border-color-on-match logic) — the same function could very plausibly drive a `nodeColor` callback passed to `<MiniMap>` directly, without inventing new matching logic.

## Real open questions (deliberately not resolved here)
- Click-to-jump (`onClick`, teleport the viewport to wherever was clicked) vs. click-and-drag-to-pan (`pannable`) vs. both — different interaction feel, not decided.
- When an element matches *multiple* enabled highlights (today's canvas renders that as chips, not a single border color — see `HighlightChips`), what should the minimap's single `nodeColor` value show? No chip concept exists at minimap scale.
- Container/text nodes' own minimap representation (do they need any special-casing, or does `nodeColor` naturally already apply per-type same as everything else)?

## Notes
Not scheduled into any current batch — flagged here so it isn't lost, not because it's next up.
