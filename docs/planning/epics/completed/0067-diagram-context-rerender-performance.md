# 0067: DiagramContext re-renders the whole diagram on every rapid setting change

## Status
Done (2026-08-25), on `epic/0067-diagram-context-rerender-performance`, pending live test/PR/merge beyond what's already confirmed below. Raised by the user (2026-08-22) after epic 0030's canvas-background-color picker: dragging the native color-input handle dropped the app to roughly 2 frames per second on the Meridian Rail landscape. The original hypothesis was confirmed live (31,000+ `ShapeNode` renders from one drag) and fixed, along with two further costs the fix itself surfaced — see [ADR 0056](../../../decisions/0056-diagram-context-rerender-performance.md) for the full decision record; this doc keeps the narrative/process notes.

## Goal
Make rapid, high-frequency state changes (a native `<input type="color">` drag firing many `onChange` events per second is the reported trigger, but likely any similarly frequent update) not tank frame rate on a large diagram.

## Working hypothesis (not confirmed live)
`DiagramContext.Provider`'s `value` prop (`Canvas.tsx`) is a plain object literal reconstructed on every render of `CanvasInner` — not wrapped in `useMemo`. Every node type (`ShapeNode`, `ContainerNode`, `TextNode`) and the edge type (`LabeledEdge`) calls `useDiagramContext()`, along with `PropertyPanel.tsx` and `ColorPickerPopup.tsx`. Since React Context re-renders every consumer whenever the Provider's `value` reference changes, and a `useState`-based settings update (`updateSettings` in `settings.ts`) re-renders `CanvasInner` on every single `onChange` firing — a rapid drag gesture likely re-renders every node and edge in the diagram many times per second. On the Meridian Rail landscape (70+ shapes, 83+ edges), that's a plausible, sufficient explanation for a drop to ~2fps; on a small diagram the same underlying issue would likely be invisible.

This would not be specific to canvas background color — it's a general property of any rapidly-firing state update that flows through `DiagramContext`, so worth checking other continuous-drag fields (slider fields, other native color inputs) for the same symptom once this is actually investigated.

## What was found and fixed
See [ADR 0056](../../../decisions/0056-diagram-context-rerender-performance.md) for the full decision — summarized here for the process trail:

1. **Confirmed the hypothesis live** with temporary `console.count` render instrumentation in `ShapeNode`/`ContainerNode`/`LabeledEdge`: a single background-color drag on the Meridian Rail landscape produced 31,080+ `ShapeNode` renders alone. Also discovered `React.memo` on these components was never protecting against this — a `useContext` subscription re-renders regardless of `memo`, which only bails out on prop changes from a parent.
2. **Memoized the `DiagramContext.Provider` value** (`useMemo`, complete dependency list) — the primary fix.
3. Live-testing that fix surfaced a real, separate regression along the way (edges/lines not rendering) that turned out to be a stale Vite dev-server module-graph cache, not a code bug — resolved by a full restart, not a code change. Confirmed via careful diff review that nothing in the actual fix could explain it.
4. Live-testing further surfaced two *additional*, genuine costs the memoization alone couldn't fix, since both were **correctly** triggering recomputation (a real change, not a stale-cache false positive):
   - `selectedEdgeHighlightColor` re-rendering every edge on every change regardless of whether anything was selected — fixed by moving it out of Context entirely onto a CSS custom property.
   - `settings.ts`'s `updateSettings` writing to disk via IPC on *every* `onChange` tick (100+ writes per drag) — fixed with a 300ms debounce on the write, decoupled from the (still-synchronous) in-memory update.
5. Even after all of the above, large/fast drags were still visibly laggy — traced to `CanvasInner` itself re-rendering once per tick regardless of which field changed, since it owns the `settings` state. Fixed with `useRafThrottledCallback` (new hook), coalescing high-frequency `onChange` events to one commit per animation frame — wired into `ColorField` (used broadly, not just for canvas background) and `SettingsPanel`'s separate edge-color input.

Confirmed by the user, live: both the background-color and edge-selection-color drags are no longer laggy, including large/fast movements that were the worst case before.

## Notes
Originally logged 2026-08-22 with an unconfirmed hypothesis; picked up and closed 2026-08-25. `useRafThrottledCallback` is now a reusable hook (`hooks/useRafThrottledCallback.ts`) for any other high-frequency input added later — this symptom is a general property of native drag-style inputs, not specific to color pickers, so it's likely to recur.
