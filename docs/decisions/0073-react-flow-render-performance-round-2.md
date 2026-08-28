# 0073: React Flow render performance, round 2

## Status
Accepted (2026-08-29). Implemented in epic 0101 and live-confirmed by the user:
the Meridian Rail landscape "felt smooth as hell" for hover, marquee-select and
colour drags, with no regressions. The profiler round and the `useDiagramStore`
split (below) were both left unused — not needed.

## Context
[ADR 0056](0056-diagram-context-rerender-performance.md) fixed one re-render
cascade (a native colour-input drag re-rendering every node 31,000+ times). A
follow-on investigation
([known-issues.md](../known-issues.md#hovering-a-single-edge-on-a-large-diagram-re-renders-every-node-and-edge-several-times-over))
found that *merely hovering one edge* on the 82-node Meridian Rail landscape still
re-renders every node and edge several times over, fixed two contributing causes
with no measurable effect, and stopped — recommending the React DevTools Profiler.

The user chose to take another structural pass first (profiler only if lag
remains), guided by React Flow's performance guide
(https://reactflow.dev/learn/advanced-use/performance), and scoped it to targeted
fixes plus viewport culling — deferring any store/architecture refactor behind a
measurement gate.

`CanvasInner` (`src/renderer/src/Canvas.tsx`, ~4680 lines) owns `nodes`/`edges`
state *and* renders every panel, dock, menu and dialog inline, so any of its ~40
`useState`s re-renders the whole body, re-runs its unmemoized O(n) derivations,
and hands React Flow freshly-built arrays.

## Decision

**1. Enable `onlyRenderVisibleElements` on `<ReactFlow>`.** React Flow then only
mounts nodes/edges whose bounding box intersects the viewport. Nodes already
carry `width`/`height` (`fromDiagramFile`), which this requires. This is the
single highest-leverage change for large diagrams and costs one prop.
Trade-offs accepted: an off-screen node unmounts, so a mid-edit `EditableLabel`
or a visible `NodeResizer` scrolled out of view resets (acceptable — the edit is
committed on blur, and scrolling away from a node you're editing is not a real
workflow); popups anchored to a node's `getBoundingClientRect` are captured at
click time so they are unaffected; the minimap reads store data, not the DOM, so
it still shows the whole diagram. PNG export (`export/exportPng.ts`) clones
`.react-flow__viewport`, so it must fit the whole diagram into view (or toggle
the flag off) before capturing — otherwise it would export only on-screen nodes.

**2. Per-edge local hover state, not a global `hoveredEdgeId`.** Catmull-rom
bend-point handles are hover-revealed; the old design tracked hover in a single
`CanvasInner` state and materialized `hovered` onto `edge.data` via a `setEdges`
effect — producing a **new `edges` array on every hover**, which rebuilt
`orderedEdges` and forced React Flow to re-sync its entire edge store. `LabeledEdge`
now owns a local `useState` hover flag, set from an invisible fat hit-path it
renders itself (`pointerEvents: 'stroke'`), so hovering an edge re-renders only
that one edge and never touches the shared array. `onEdgeMouseEnter`/
`onEdgeMouseLeave`, the `hoveredEdgeId` state, and `edge.data.hovered` are
removed; `deriveEdgeFields` now derives only `zIndex`.

**3. Preserve `orderedEdges`' array identity when no edge is selected.** The
selected-last DOM reorder is only a tie-breaker for edges of equal computed
z-index — the real selected-edge priority is `SELECTED_EDGE_Z_BOOST` in
`deriveEdgeFields` (see known-issues.md). The `useMemo` now returns the `edges`
array unchanged unless at least one edge is selected, keeping the `<ReactFlow
edges>` reference stable across the common case.

**4. Memoize `nodeZIndexById` and the render-body derivations.** `nodeZIndexById`
was `new Map(...)` every render, forcing the edge-derive `useEffect` (which has it
in deps) to run on every `CanvasInner` render. `selectedNodes`, `selectedEdges`,
`layerRows`, `referenceRows`, `displayedDiagnostics` were rebuilt every render and
passed as props to `DiagramDock` and the docked panels; now `useMemo`d on their
real inputs, with `DiagramDock` `memo()`d and its last inline-arrow prop
(`onSetDefaultStyle`) promoted to a `useCallback`. (`menus` / `MenuBar` left
alone — several of its handlers legitimately churn via the save path, and it's
cheap to reconcile.)

**4a. Stabilize the callbacks threaded through `DiagramContext` (found mid-epic —
likely the dominant cause).** ADR 0056 memoized the context value, but
`pushSnapshot`, `beginContinuousEdit`, `openDetailsPanel` and `handleLinkClick`
all closed over `nodes`/`edges` (directly or transitively), so the memoized value
got a **fresh identity on every edit** — re-rendering every node and edge through
`useContext`, which no `React.memo` guards against. The prior round checked the
context value's own dependency list but not that those callback deps depended on
the very array a hover/edit was mutating. Fix: a `graphRef` (nodes/edges mirrored
into a ref from an effect) that `pushSnapshot`/`undo`/`redo` read instead of
closing over state; `openDetailsPanel` reads the node via `rfInstance.getNode`
(the pattern `openReferencesFor` already used); and a new `useEventCallback` hook
(the standard "useEvent" ref-wrapper, sibling to `useRafThrottledCallback`) for
`handleLinkClick`, whose closure reaches the whole save path via `persistDiagram`
and isn't worth threading through refs.

**5. `memo()` `EdgeMarkerDefs`** — pure static JSX that reconciled on every
`CanvasInner` render.

## Alternatives considered

**A `useDiagramStore` (Zustand) with selectors**, so panels and the flow host
subscribe to slices instead of everything hanging off `CanvasInner`. This is
React Flow's own recommended pattern ("decouple selection state") and the real
structural fix for Problem A (component re-render isolation). Deferred behind a
**decision gate**: after the fixes above land and are live-tested on the large
landscape, if any of hover / marquee / colour-drag is still laggy, this becomes
its own epic with its own ADR — not bolted onto this round. Rejected as this
round's scope because it is a multi-session refactor touching every panel and
every mutation path, with real regression risk, and the cheaper fixes may make it
unnecessary. **Outcome: the gate was met — all three gestures are smooth — so
this was not done. It remains the documented next step only if perf regresses
under continued use.**

**React DevTools Profiler first.** The prior round's recommended next step.
Deferred by the user's choice — structural fixes first, profiler only if lag
remains. Kept as the fallback if the decision gate isn't met.

**Coarser (sub-frame) throttling of the colour preview.** ADR 0056 already
deferred throttling as a primary fix — it treats the symptom. Not revisited;
the isolation and culling work should remove the need.

**rAF-throttling `onNodeDrag`** (it maps over every node per mousemove tick when
a snap correction applies). Tried, then reverted: `useRafThrottledCallback`
schedules a frame and can't be flushed on demand, so a throttled tick's frame
can fire *after* `onNodeDragStop`, re-applying a stale snap correction after the
drop — the exact "node jumps back on release" bug `onNodeDragStop`'s own comment
exists to prevent. Not worth destabilizing a tuned interaction for a gesture that
wasn't the reported symptom.

## Consequences
- `DiagramContextValue` is unchanged by this round (hover was never on it).
- `useEventCallback` (`hooks/useEventCallback.ts`) is now available for any other
  handler that must be identity-stable despite closing over changing state —
  likely recurring, same as `useRafThrottledCallback`.
- `graphRef` in `Canvas.tsx` is the read-path for "current nodes/edges" in
  callbacks that must not list them as deps; keep new such callbacks on it too.
- `edge.data.hovered` no longer exists — a reader of `LabeledEdge` should look at
  its local `hovered` state, not edge data.
- `onlyRenderVisibleElements` means off-screen elements are genuinely unmounted —
  any future feature that assumes every node has a live DOM node (measurement,
  bulk `getBoundingClientRect`, animations) must account for that, and PNG export
  must keep fitting the whole diagram before capture.
- No `.chd` / file-format impact.
- If the decision gate isn't met, the next step is a dedicated store-refactor or
  profiler epic, not further guessing.
