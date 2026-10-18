# 0083: Per-set edge style — a creation template, not a live layer

## Status

Accepted (2026-09-04). Extends [ADR 0081](0081-flippable-edge-direction-sets.md)
(named edge direction sets): a direction set gains an optional default edge
style. Builds on [ADR 0014](0014-node-and-edge-style-schema.md) (`EdgeStyle`)
and [ADR 0045](0045-default-edge-style-setting.md) (the global default-edge-style
preference this composes with).

## Context

ADR 0081 shipped named "readings" of a diagram's edges that differ only in
arrow direction, and deliberately scoped itself to *direction only*. It left
open — as a separate concern — letting a reading also carry its own visual
**style**, so a diagram can draw its "Data flow" edges solid black and its
"Trigger direction" edges dashed blue without hand-styling every edge.

ADR 0081 already gave each set a `legend` object (`color` / `lineStyle` /
`startMarker` / `endMarker`) describing how that set draws as a **legend
row** while active — explicitly author-asserted, explicitly *not* something
that touched the real edges.

The design question for this ADR was how a real per-set style relates to the
edges. Three models were put to the user:

1. **Creation template.** The set's style seeds newly-drawn edges only;
   existing edges are never touched; switching sets changes direction only.
2. **Per-(edge, set) style.** Each edge remembers a style per set, seeded
   from the set default, overridable by hand per set; switching sets
   re-styles every edge to its stored per-set look.
3. **Single shared style, overwritten on switch.** One style per edge; a
   switch overwrites it from the incoming set's default.

## Decision

**Model 1 — the set style is a creation template plus the legend row's
appearance. It never mutates an existing edge, and switching the active set
changes direction only, exactly as ADR 0081 already specified.**

The user's framing: *"it should not be cascaded to all edges. It should just
be the default for that edge set. If I create a new edge, use the set
default edge style. If I change an edge, that change should be persisted.
Thus there is no overriding problem."*

Consequences of picking model 1:

- **No render-time resolution.** An edge's look is still `edge.data.style`
  over the built-in default, full stop. `LabeledEdge` is untouched. No new
  `DiagramContext` field. By the time an edge exists, its style is its own
  ordinary `EdgeStyle` (the direction-reverse operation, see below, doesn't
  touch markers at all).
- **No per-(edge, set) style storage.** `directionSets` records stay
  `{ source, target, sourceHandle?, targetHandle? }`.
- **Switching sets never restyles anything.** This is a real limitation
  versus the original "without re-styling every edge on each switch"
  aspiration — accepted deliberately by the user. The delivered value is:
  new edges drawn while a reading is active are born in that reading's look,
  and the legend row reflects it.

### Schema — fold `legend` into `style`

`EdgeDirectionSet.legend` is **renamed to `style`** and widened. The set's
default style *is* what the legend row shows (the user: *"the derived legend
edge style should match the set default styling"*), so an independent
`legend` field is redundant.

```ts
// A strict subset of EdgeStyle — the fields that make sense as a per-reading
// default. No routingStyle (geometry / bend-point-coupled, stays per-edge),
// no font, no labelPosition.
export type EdgeDirectionSetStyle = Pick<
  EdgeStyle,
  'stroke' | 'strokeWidth' | 'strokeOpacity' | 'lineStyle' | 'startMarker' | 'endMarker'
>

export interface EdgeDirectionSet {
  id: string
  name: string
  style?: EdgeDirectionSetStyle   // was `legend?: EdgeDirectionSetLegend`
}
```

- `EdgeDirectionSetLegend`'s `color` becomes `style.stroke` (aligns with
  `EdgeStyle` vocabulary — the value is a stroke colour).
- Additive fields: `strokeWidth`, `strokeOpacity`.

### Legacy `legend` → `style` migration

`fromDiagramFile` maps any set carrying the old `legend` shape into `style`
when `style` is absent: `{ color → stroke, lineStyle, startMarker,
endMarker }`. One-directional, on load; writers only ever emit `style`.
Exactly one `.chd` in the repo used `legend` (the Power BI star-schema
gallery example) — migrated in place in the same change. No `.chd` version
bump (consistent with ADR 0081 shipping `legend` without one).

### Where the template is applied

The two brand-new-edge sites in `Canvas.tsx` — `onConnect` (covers the
multi-connection wiring, which is folded into it) and `onConnectEnd` — seed
`data.style` with:

```ts
{ ...preferences.defaultEdgeStyle, ...activeDirectionSetStyle(sets, activeId) }
```

The global default ([ADR 0045](0045-default-edge-style-setting.md)) still
supplies everything the set style doesn't (notably `routingStyle`); the set
style overrides `stroke` / `strokeWidth` / `strokeOpacity` / `lineStyle` /
markers when it sets them. With no direction sets, or an active set with no
`style`, the seed is exactly `preferences.defaultEdgeStyle` — unchanged from
today.

**Paste is deliberately not reseeded** — `remapForPaste` copies an existing
edge, style included; that is a copy, not authoring a fresh edge, and the
user's rule is about newly-created edges.

### Legend row

`directionSetLegendRow()` sources the row from the active set's `style`
instead of `legend`: `color = style.stroke ?? DEFAULT_DIRECTION_SET_LEGEND_COLOR`,
plus `lineStyle` / `startMarker` / `endMarker`. `strokeWidth` is **not**
reflected in the legend swatch in v1 (the swatch renders a fixed 2px line —
a minor, logged deferral); it still seeds real edges.

### UI

The per-set row in `EdgeDirectionSetsSection` is
`[style preview] [✎] [name] [⧉ duplicate] [✕ delete]`. The preview swatch
is read-only (colour + width + dash + markers + opacity of the set style);
**✎ opens a floating `EdgeDirectionSetStyleEditor`** anchored to the button.

That editor reuses the **Property panel's own field primitives**
(`SelectField` / `ColorField` / `SliderField` / `NumberField` from
`panels/fields.tsx`, `MARKER_OPTIONS` / `LINE_STYLE_OPTIONS` moved to a new
`panels/edgeStyleOptions.ts`) laid out as Start / Line / End sections — so
editing a reading's default looks and behaves like editing a real edge,
minus what a per-reading default has no use for: routing/geometry, label
font, metadata. Fields: start marker, end marker, stroke colour
(theme-adaptive, palette swatches), opacity, width, line style. Session /
snapshot callbacks are no-ops — a set-style edit is not an undo step (ADR
0081), and `onUpdateStyle` already marks the document dirty.

*(First pass shipped a sparse inline row — colour input + width input +
`StylePicker` dropdown — which the user found too limited; replaced by the
editor above the same day.)*

The section hint states the style is the default for edges *drawn while
this reading is active* and is what the legend row shows.

### Reversing an edge's direction — `flipEdgeVisuals` → `reverseEdgeDirection`

Seeding an edge with an explicit end marker exposed a latent bug in the
old `flipEdgeVisuals` helper (ADR 0081, shared by "Reverse direction" and a
set switch). It returned *only* the visual touch-ups and swapped
`startMarker` ↔ `endMarker` by value; each caller then separately swapped
`source`/`target` and merged the result. But swapping `source`/`target` on
its own already relocates the visible arrowhead — `endMarker` renders at
`target`, `startMarker` at `source` — so doing both cancels out:

- one-arrow edge `{ endMarker: 'arrowClosed' }` → still one arrow on the
  **same physical end** → "Reverse direction" is a visual no-op;
- an interim `undefined`→`'none'` patch left it a no-op; before that it
  showed arrows on **both** ends (`endMarker: undefined` fell through to
  React Flow's default end arrow in `LabeledEdge`).

The helper was also mis-factored — a "reverse an edge" operation should
*be* one function that reverses the edge, not a "flip the visuals" fragment
callers compose by hand. Replaced by **`reverseEdgeDirection(edge): Edge`**:
it swaps the endpoints (`source`/`target` + handles) and fixes up only what
that swap doesn't handle itself — the catmull-rom `points` order and a
custom `labelPosition` (both defined along the source→target walk).
**Markers are untouched.** The "Reverse direction" menu action calls it
directly; `applyDirectionToEdge` calls it for the flip case, then overrides
the endpoints/handles from the stored `EdgeDirection` record. A clean
byte-for-byte involution. An earlier note that markers should "travel with
their physical end" was backwards for what the feature is for, and it had
never been live-tested — plain edges (empty `style`) happened to work via
RF's default arrow tracking `target`.

Also: new edges get their per-set `directionSets` records seeded eagerly at
creation (2+ sets), not lazily at the next switch, so reversing a
just-drawn edge no longer bakes the reversed orientation into every
reading.

### History / dormancy

A set-style edit dirties the document but is **not** an undo step — matches
how set create / rename / delete / switch and the old `legend` edit already
behave (ADR 0081). `style` is meaningful from one set (a single reading can
still define a diagram-wide new-edge default + legend row). Absent →
today's behaviour exactly.

## Alternatives considered

- **Model 2 (per-(edge, set) style).** The most flexible — genuinely
  per-reading edge appearance. Rejected by the user: multiplies per-edge
  storage the way `directionSets` already does, needs `LabeledEdge` to
  resolve style against the active set, and forces a decision about how a
  set-level marker override composes with the flip involution. Not worth it
  for the stated use case.
- **Model 3 (shared style, overwritten on switch).** Cheapest restyle-on-
  switch option, but a hand edit silently "leaks" across readings until
  edited again, and a switch (not an undo step) would clobber deliberate
  per-edge styling with no clean recovery.
- **Keep `legend` and add a separate `style`.** Two overlapping fields
  (`legend.color` vs `style.stroke`, both `lineStyle`/markers) that can
  disagree. The user wants the legend to *match* the set default, so one
  field is correct.
- **Live cascade `edge.style.X ?? activeSet.style.X ?? default` at render.**
  The original proposal in the design pass. Delivers restyle-on-
  switch cleanly (per-edge explicit always wins), but the user explicitly
  did not want existing edges affected by a set at all.
- **Include `routingStyle` in the template.** Routing is coupled to
  `points` semantics and bend/segment-drag UI; a per-reading routing
  default is a different feature. Left per-edge / global-default only.

## Consequences

- `src/shared/diagram.ts`: `EdgeDirectionSetLegend` → `EdgeDirectionSetStyle`
  (`Pick<EdgeStyle, …>`); `EdgeDirectionSet.legend` → `style`.
- `renderer/src/edges/edgeDirectionSets.ts`: `directionSetLegendRow` reads
  `style`; new `activeDirectionSetStyle(sets, activeId)` helper for the seed
  sites; `DEFAULT_DIRECTION_SET_LEGEND_COLOR` unchanged (still the swatch
  fallback).
- `renderer/src/Canvas.tsx`: two seed sites merge the active set's style;
  they also seed per-set `directionSets` eagerly at 2+ sets;
  `fromDiagramFile` runs the `legend` → `style` migration; handler +
  prop renames (`updateEdgeDirectionSetLegend` → `…Style`).
- `renderer/src/edges/edgeDirectionSets.ts`: `flipEdgeVisuals` replaced by
  `reverseEdgeDirection(edge): Edge` (whole-edge reverse, markers untouched
  — see "Reversing an edge's direction"); `applyDirectionToEdge` uses it.
- `renderer/src/components/EdgeDirectionSetsSection.tsx`: row is preview +
  ✎ + name + duplicate + delete; hint reworded.
- New `renderer/src/components/EdgeDirectionSetStyleEditor.tsx` (floating
  editor) + `renderer/src/panels/edgeStyleOptions.ts` (`MARKER_OPTIONS` /
  `LINE_STYLE_OPTIONS`, moved out of `PropertyPanel.tsx`).
- `LabeledEdge`, `directionSets` per-edge record *shape*, switch/save/load
  orientation logic, PNG export, `DiagramContext` — all untouched.
- `docs/file-format.md`: the "Edge direction sets" section's `legend` row
  becomes `style` with the widened field list and the "seeds new edges,
  does not restyle existing ones" note.
- `examples/gallery/data/star-schema-powerbi.chd`: `legend` → `style`.
- Logged deferral: `strokeWidth` not shown in the legend swatch.
