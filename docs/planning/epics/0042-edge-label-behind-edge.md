# 0042: Edge label renders behind its own edge line

## Status
Done (2026-08-21). Root-caused and fixed with a single CSS rule — see below.

## Goal
An edge's label should always render visually in front of its own line (and ideally anything else it overlaps), so it stays legible regardless of how the edge is routed or what crosses it.

## Root cause
Confirmed via direct DOM inspection of the running app (`getComputedStyle`), not just static reading:

- Canvas.tsx's `zIndexedNodes` gives every non-container node an inline `zIndex: 2000` **unconditionally** — not gated on selection. React Flow renders that straight onto each `.react-flow__node`'s `z-index`.
- `.react-flow__edgelabel-renderer` — the single shared div `EdgeLabelRenderer` portals every edge label into (see `LabeledEdge.tsx`) — gets no `z-index` of its own from React Flow (computed style: `auto`).
- Since `auto` and `0` sit at the same stacking level and paint in DOM order, and `.react-flow__edgelabel-renderer` is a DOM sibling that comes *before* `.react-flow__nodes` in React Flow's own render tree, a label was already losing to *any* node it overlapped (busy hubs like `booking-api-component.chd`'s 11-edge node put labels right next to a z-index:2000 box).
- Separately, `@xyflow/system`'s `getElevatedEdgeZIndex` gives an edge's own SVG wrapper an explicit `z-index` — elevated whenever the edge is selected (+1000, `elevateEdgesOnSelect` defaults to `true`), and *unconditionally* whenever either endpoint node has a `parentId` (i.e. lives inside a container) or is itself selected, in which case the edge inherits that node's full z (2000+). That's a second, independent way for an edge's own line to end up above its own label.

Both mechanisms have the same fix: give the label-portal container a z-index comfortably above anything React Flow or this app assigns to nodes/edges today.

## Fix
`src/renderer/src/assets/main.css`: `.react-flow__edgelabel-renderer { z-index: 5000; }`, with a comment explaining the coupling to Canvas.tsx's `zIndexedNodes` and a pointer to revisit if epic 0043 changes that scheme. Verified by reading the computed z-index back out of the live dev-server DOM (`2000` on `.react-flow__node`, `5000` on `.react-flow__edgelabel-renderer` after the change) — actual pixel-level rendering wasn't re-verified visually in-session, since screenshotting wasn't reliably available; worth a quick look by the user in the real app, particularly on `booking-api-component.chd`.

## Notes
Investigated via the Vite dev server in a plain browser tab (electron-vite serves the renderer there too), not the packaged Electron shell — file open/save didn't work in that mode (no preload `window.api`), so the repro used two shapes added via the item palette and manual DOM inspection rather than an opened gallery file.
