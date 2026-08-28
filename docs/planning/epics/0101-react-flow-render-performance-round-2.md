# 0101: React Flow render performance, round 2

## Status
Done (2026-08-29), live-tested and confirmed by the user, on
`epic/0101-react-flow-render-performance-round-2` — pending PR/merge. The user
reported the large diagram "felt smooth as hell" across every gesture they tried,
with no regressions found. Will keep an eye on feel/perf over continued use.

## Goal
Make ordinary interactions on a large diagram (the 82-node/84-edge Meridian Rail
landscape) stop being laggy — picking a colour, selecting shapes, marquee-select,
hovering edges. Continues [ADR 0056](../../decisions/0056-diagram-context-rerender-performance.md)
(epic 0067), which fixed one re-render cascade but left the
["hovering a single edge re-renders every node and edge"](../../known-issues.md#hovering-a-single-edge-on-a-large-diagram-re-renders-every-node-and-edge-several-times-over)
issue open.

## Approach
Structural fixes first (no React DevTools Profiler round, no state-store refactor),
guided by React Flow's own performance guide
(https://reactflow.dev/learn/advanced-use/performance), with a decision gate: if
any gesture was still laggy after this batch, stop and open a dedicated
profiler/store epic rather than keep guessing. It wasn't — the gate is met, this
round stands on its own. See [ADR 0073](../../decisions/0073-react-flow-render-performance-round-2.md).

## What was done (all shipped, all live-confirmed)

- [x] **Fix 0 — viewport culling.** `onlyRenderVisibleElements` on `<ReactFlow>`.
  React Flow now only mounts nodes/edges intersecting the viewport. Disabled
  during PNG export via `isExportingPng` state, which also forces
  `updateNodeInternals` + a two-frame wait so just-mounted off-screen edges
  resolve before the `.react-flow__viewport` clone. Commit `0a9e01d`.
- [x] **Fix 1 — localize edge hover.** Removed the global `hoveredEdgeId` state,
  `onEdgeMouseEnter`/`onEdgeMouseLeave`, and `edge.data.hovered`. Hover is now
  per-edge local `useState` in `LabeledEdge`, set from an invisible
  `HOVER_HIT_WIDTH` (20px) hit-path the edge renders on top of `BaseEdge`.
  `deriveEdgeFields` derives only `zIndex` now. Commit `7660d62`.
- [x] **Fix 2 — memoize `nodeZIndexById`.** It was `new Map(...)` every render, so
  the edge z-index `useEffect` (which has it in deps) ran on every `CanvasInner`
  render. Commit `7660d62`.
- [x] **Fix 3 — preserve `orderedEdges` array identity** unless an edge is
  actually selected. Commit `7660d62`.
- [x] **Fix 4 — memoize render-body derivations.** `selectedNodes`,
  `selectedEdges`, `layerRows`, `referenceRows`, `displayedDiagnostics` now
  `useMemo`d; `hasSelectedNodes` derives from the memoized `selectedNodes`;
  `memo()` on `DiagramDock` with a `useCallback` `setDefaultStyle` (was an inline
  arrow). Commit `1a9d203`.
- [x] **Fix 4a — stabilize the `DiagramContext` callbacks (found mid-epic; the
  actual dominant cause).** `pushSnapshot`, `beginContinuousEdit`,
  `openDetailsPanel` and `handleLinkClick` all closed over `nodes`/`edges`
  (directly or transitively via `persistDiagram`), so the memoized
  `diagramContextValue` (ADR 0056) got a fresh identity on **every edit** —
  re-rendering every node and edge through `useContext`. Fixed with a `graphRef`
  (nodes/edges mirrored into a ref from an effect) that `pushSnapshot`/`undo`/
  `redo` read; `openDetailsPanel` reads the node via `rfInstance.getNode`; and a
  new `useEventCallback` hook (`hooks/useEventCallback.ts`) for `handleLinkClick`.
  Commit `1a9d203`.
- [x] **Fix 5 — `memo()` `EdgeMarkerDefs`.** Static JSX that reconciled on every
  `CanvasInner` render. Commit `1a9d203`.
- [x] `npm run typecheck` + `npm run lint` clean (0 errors; the pre-existing
  `bendPoints`/`points` exhaustive-deps *warnings* in `LabeledEdge`/`LineNode`
  are unchanged — not introduced here).

## What worked (live-tested by the user on the Meridian Rail landscape)

- Hovering rapidly across many edges — smooth, no stutter; catmull-rom bend
  points still hover-reveal.
- Marquee-select crossing shapes/edges repeatedly — the ~300ms per-crossing
  stutter is gone.
- Dragging fill/border colour and the canvas background colour — live preview
  stays smooth.
- Regression sweep clean: PNG export of an oversized diagram still captures the
  whole thing, fast panning to off-screen nodes/edges, edge selection + reconnect
  handles, undo/redo, container delete-reparents, layer panel, highlights,
  linked-diagram navigation — all still work.
- Overall: "felt smooth as hell … much smoother now."

## What didn't work / was dropped

- **Fix 7 — rAF-throttling `onNodeDrag`** (was in the plan). Implemented, then
  reverted before committing. `useRafThrottledCallback` schedules a frame it
  can't flush on demand, so a throttled tick's frame can fire *after*
  `onNodeDragStop`, re-applying a stale snap correction after the drop — the
  exact "node jumps back on release" bug `onNodeDragStop`'s own comment exists to
  prevent. Not worth destabilizing a tuned interaction for a gesture that was
  never the reported symptom. A state-store refactor would address drag cost
  properly if it ever matters.
- **Fix 6 — lazy `usedTags`** (optional in the plan). Not done — it was gated on
  colour-drag lag persisting after Fixes 0–5, and it didn't. Left as a note in
  case it resurfaces.
- **React DevTools Profiler round** (the prior round's recommended next step).
  Not needed — the dominant cause (Fix 4a) was found by code reading. Profiler
  stays the fallback if perf regresses.
- **`useDiagramStore` (Zustand) refactor** — the "deepest fix" of extracting
  diagram + UI state out of the 4,600-line `CanvasInner` so the flow host stops
  re-rendering on unrelated panel/search/colour state. **Deemed not needed** this
  round: the targeted fixes + culling met the bar with far less blast radius. It
  remains the documented next step (its own epic + ADR) *only* if perf regresses
  under continued use.

## What was deemed not needed (considered, deliberately skipped)

- Memoizing `menus` / `memo()` on `MenuBar` — several of its handlers legitimately
  churn via the save path, and it's cheap to reconcile.
- Touching the two "materialize derived fields onto state via `useEffect`" passes
  (`deriveNodeFields`/`deriveEdgeFields`) — Fix 2 removed their per-render churn;
  the remaining extra render pass on a genuine change is acceptable.
- `elevateEdgesOnSelect` — React Flow's built-in +1000 selection bump can't
  dominate this app's custom z-index scale (up to ~200k), so the explicit
  `SELECTED_EDGE_Z_BOOST` stays.

## Notes
- No `.chd` / file-format impact — `edge.data.hovered` was never serialized.
- Committed per fix group so a future regression bisects cleanly.
- `useEventCallback` and `graphRef` are the reusable outcomes: any future callback
  that must stay identity-stable while reading current graph state should use one
  of them rather than listing `nodes`/`edges` in a dep array.
- The long-open ["hovering a single edge…"](../../known-issues.md#hovering-a-single-edge-on-a-large-diagram-re-renders-every-node-and-edge-several-times-over)
  known issue is now Solved — see that entry for the full root-cause account and
  why the prior round's "context value is properly memoized" conclusion was a
  near-miss.
