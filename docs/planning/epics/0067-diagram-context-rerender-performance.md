# 0067: DiagramContext re-renders the whole diagram on every rapid setting change

## Status
Not Started — not yet scoped. Raised by the user (2026-08-22) after epic 0030's canvas-background-color picker: dragging the native color-input handle dropped the app to roughly 2 frames per second on the Meridian Rail landscape. "Misc things to do at some point," not urgent, not investigated live — logged with a grounded hypothesis from a quick read, not a confirmed root cause.

## Goal
Make rapid, high-frequency state changes (a native `<input type="color">` drag firing many `onChange` events per second is the reported trigger, but likely any similarly frequent update) not tank frame rate on a large diagram.

## Working hypothesis (not confirmed live)
`DiagramContext.Provider`'s `value` prop (`Canvas.tsx`) is a plain object literal reconstructed on every render of `CanvasInner` — not wrapped in `useMemo`. Every node type (`ShapeNode`, `ContainerNode`, `TextNode`) and the edge type (`LabeledEdge`) calls `useDiagramContext()`, along with `PropertyPanel.tsx` and `ColorPickerPopup.tsx`. Since React Context re-renders every consumer whenever the Provider's `value` reference changes, and a `useState`-based settings update (`updateSettings` in `settings.ts`) re-renders `CanvasInner` on every single `onChange` firing — a rapid drag gesture likely re-renders every node and edge in the diagram many times per second. On the Meridian Rail landscape (70+ shapes, 83+ edges), that's a plausible, sufficient explanation for a drop to ~2fps; on a small diagram the same underlying issue would likely be invisible.

This would not be specific to canvas background color — it's a general property of any rapidly-firing state update that flows through `DiagramContext`, so worth checking other continuous-drag fields (slider fields, other native color inputs) for the same symptom once this is actually investigated.

## Real open questions (deliberately not resolved here)
- **Confirm the hypothesis first** — e.g. with React DevTools' profiler, or temporary render-count logging in `ShapeNode`/`LabeledEdge`, before assuming the fix below is even the right one.
- **If confirmed, the fix is likely `useMemo` on the context value**, keyed on its actual dependencies — but `DiagramContext`'s value bundles many different concerns (callbacks, global settings, theme, session state) with different real change frequencies; worth checking whether splitting it into more than one context (a rarely-changing one and a frequently-changing one) is warranted, or whether one `useMemo` with a complete dependency list is enough.
- **Whether the settings themselves need to change less frequently** — e.g. a native color input's `onChange` firing on every drag tick vs. only on release/blur — as an alternative or complementary fix to memoizing the context.

## Notes
Not scheduled into any current batch — logged the same day it was raised. Not investigated live (no profiling done, no fix attempted); the hypothesis above is a reasonable starting point from reading `Canvas.tsx`'s `DiagramContext.Provider` and grepping every `useDiagramContext()` call site, not a confirmed diagnosis.
