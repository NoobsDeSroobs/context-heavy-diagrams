# 0056: Fixing the DiagramContext re-render cascade

## Status
Accepted (2026-08-25)

## Context
[Epic 0067](../planning/epics/0067-diagram-context-rerender-performance.md) reported a large-diagram frame-rate drop while dragging a native color-input handle (e.g. canvas background color) — confirmed live via render-count instrumentation: a single background-color drag on the ~70-shape/84-edge Meridian Rail landscape triggered over 31,000 `ShapeNode` renders. The working hypothesis (unconfirmed until this epic): `DiagramContext.Provider`'s `value` prop (`Canvas.tsx`) was a plain object literal rebuilt on every render of `CanvasInner`, with no memoization, so every context consumer (`ShapeNode`, `ContainerNode`, `TextNode`, `LabeledEdge`, `LineNode`) re-rendered on every tick of *any* settings change, not just the one field being dragged.

Fixing the first, most obvious cause (memoizing the context value) surfaced two further, distinct costs that weren't part of the original hypothesis but produced the same symptom for other fields, discovered by live-testing each fix in turn.

## Decision

**1. Memoize `DiagramContext.Provider`'s value (`useMemo`, `Canvas.tsx`).** Every function already passed into it was already `useCallback`-stable; the fix was purely wrapping the object literal itself with a complete, correct dependency list. Confirmed this was necessary but not sufficient — `React.memo` on `ShapeNode`/`ContainerNode`/`LabeledEdge` had never protected against this: `memo` only bails out on unchanged *props* from a parent, not on a `useContext` subscription, which re-renders its component whenever the Provider's value identity changes regardless of any `memo` wrapper elsewhere on that component.

**2. Move `selectedEdgeHighlightColor` out of `DiagramContext` entirely, onto a CSS custom property.** This value is only ever read by whichever edge is currently *selected* — usually zero or one of many — but living in the shared context meant any change to it re-rendered every edge regardless of selection state, which the memoization in (1) can't fix (the value genuinely changed, so a correct dependency array *must* recompute and re-render every consumer). Set once, alongside the pre-existing `--xy-background-color` var, on the `<ReactFlow>` wrapper's own `style` prop; `LabeledEdge` references `var(--selected-edge-highlight-color)` directly in its stroke when selected. The browser resolves the var at paint time — no React re-render needed for any edge, selected or not.

**3. Debounce settings persistence (`settings.ts`'s `updateSettings`), decoupled from the in-memory update.** `updateSettings` was calling `window.api.writeAppSettings(next)` — an IPC round-trip plus a disk write — on every single call, meaning a rapid color drag triggered 100+ writes in quick succession. `setSettings` (the in-memory React state, which everything visual depends on) still runs synchronously on every tick; only the actual file write is debounced (300ms after the last change), with a pending write flushed on unmount so nothing is silently lost.

**4. Coalesce high-frequency `onChange` events to one commit per animation frame (`useRafThrottledCallback`, new hook).** Even with (1)–(3) fixed, large/fast color-picker drags were still visibly laggy — traced to `setSettings` itself forcing `CanvasInner` (a very large component) to fully re-render and reconcile its tree on every native `input` tick, independent of which field changed or where that field lives. A plain object-literal identity check can't help here since the *state itself* is what's changing on every tick. `useRafThrottledCallback` coalesces multiple ticks arriving within one frame into a single call carrying the latest value — imperceptible from a live drag (60fps already exceeds what's visible as continuous), but caps the number of `CanvasInner` re-renders to the display's own refresh rate instead of the input device's native event rate. Wired into `ColorField` (`panels/fields.tsx`, the shared component used for canvas background and per-shape/edge style colors) and `SettingsPanel`'s separate edge-selection-color input, which doesn't go through `ColorField`.

## Alternatives considered

**Throttling/debouncing the color input as the primary fix, before memoizing the context.** Raised early in this epic's discussion and deliberately deferred: it treats one symptom at one call site, doesn't help every other current or future rapid-input field, and (at a fixed delay rather than animation-frame granularity) costs live-preview smoothness the memoization fix doesn't. Used only once the structural fixes above left a genuine, confirmed-live residual cost.

**Splitting `DiagramContext` into multiple contexts by change frequency** (raised as an open question in the epic doc before this work started). Not needed in the end — moving `selectedEdgeHighlightColor` to a CSS var solved the one field that actually needed this, without adding a second context that every consumer would still need to know about.

## Consequences
- `DiagramContextValue` no longer includes `selectedEdgeHighlightColor` — a reader of `DiagramContext.tsx` should look at `Canvas.tsx`'s `<ReactFlow style>` prop and `LabeledEdge`'s stroke computation instead.
- `useRafThrottledCallback` (`hooks/useRafThrottledCallback.ts`) is now available for any other high-frequency input this app adds later (sliders, other continuous drags) — the epic's own notes flagged this as a likely-recurring pattern, not a one-off.
- Settings writes are eventually consistent within 300ms of the last change, not immediate — acceptable for app-level preferences (unlike diagram content, which has no such delay anywhere in this codebase).
- No `.chd`/file-format impact — this is entirely rendering/settings-persistence plumbing.
