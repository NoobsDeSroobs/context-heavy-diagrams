# 0045: Default edge style as a toolbar-visible setting

## Status
Accepted

## Context
`<ReactFlow defaultEdgeOptions={{ type: 'labeled', markerEnd: {...} }}>` (`Canvas.tsx`) already governs what a freshly drawn edge looks like, but it's hardcoded — not a user-adjustable setting, and not shown anywhere. [Epic 0061](../planning/epics/0061-toolbar-default-edge-style-and-filename-display.md) asked for a real, toolbar-visible control, closer to how drawing tools persistently show a "current pen style" indicator than a setting buried in a dialog.

## Decision
- **Represented as a full `EdgeStyle` (the same shape `StylePicker`'s presets already produce, ADR 0010), stored as `AppSettings.defaultEdgeStyle`** — not a narrower "just color" or "just line style" setting. Reusing the exact schema an edge's own `data.style` already uses means no new concept: this setting *is* "the raw style fields a new edge starts with," same relationship ADR 0010 already established between a preset and an edge's stored style.
- **The toolbar control reuses `StylePicker` unmodified** — same searchable named-preset popup already reachable via an edge's right-click "Line style…". `onPick` here calls `updateSettings({ defaultEdgeStyle: patch })` instead of `updateEdgeStyle([edgeId], patch)`; no changes needed to the picker component itself.
- **Picking a preset replaces the setting wholesale, not merged into whatever was there.** Matches the existing single-edge behavior (picking a preset for one edge replaces that edge's look, doesn't layer onto it) — "this preset is now the default" is a clearer mental model than field-by-field merging.
- **New edges get an explicit `data.style: settings.defaultEdgeStyle` stamped on creation** (both `onConnect` and `onConnectEnd`'s drag-to-create path in `Canvas.tsx`), rather than only relying on `<ReactFlow>`'s own `defaultEdgeOptions`. `defaultEdgeOptions` itself is untouched and still the ultimate fallback (`markerEnd: ArrowClosed`) for whichever fields the setting itself leaves unset — no double bookkeeping, since `LabeledEdge.tsx` already resolves an unset `data.style` field from the React-Flow-level default exactly this way.
- **Default value is `{}`** — an empty style object, so existing behavior is unchanged until a user deliberately picks something. No new hardcoded "default default" was introduced.
- **A small inline SVG swatch, not a live-rendered mini edge.** The toolbar button previews stroke color/width/dash pattern and a simple triangular end-marker cue (shown unless `endMarker === 'none'`), close enough to "what a new edge will look like" for a persistent glance-indicator without trying to replicate every `MarkerKind` shape in a 28×16 preview.

## Alternatives considered
- **A narrower setting (color/line-style only, no markers/width).** Rejected — would need its own bespoke UI anyway, whereas reusing the full `EdgeStyle` shape gets the whole existing `StylePicker` for free.
- **A new dedicated picker UI just for the default.** Rejected — `StylePicker` already does exactly "pick a preset or raw style, get an `EdgeStyle` patch back"; a second implementation of the same interaction would be pure duplication.
- **Toolbar-only state, not a real `AppSettings` field.** Rejected — this is exactly the kind of global, persistent, cross-diagram preference `settings.ts` already exists for (same category as `edgeStraightSegmentLength`/`selectedEdgeHighlightColor`), and keeping it there means it also shows up in `SettingsPanel` implicitly consistent with the rest, even though the toolbar swatch is the primary way to reach it.

## Consequences
- `AppSettings.defaultEdgeStyle: EdgeStyle` (`settings.ts`), default `{}`.
- `Canvas.tsx`: both edge-creation sites (`onConnect`, `onConnectEnd`) now stamp `data.style` explicitly at creation time instead of leaving it entirely to `<ReactFlow>`'s own resolution.
- Toolbar gains a small clickable swatch next to the filename display, opening the same `StylePicker` popup edges already use via right-click.
- No `.chd` file-format change — `EdgeStyle` itself is unchanged; this only affects what gets written into a *new* edge's existing `style` field at creation time.
