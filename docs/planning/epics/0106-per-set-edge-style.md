# 0106: Per-set edge style (e.g. "Trigger direction" always dashed)

## Status

In Progress — on `epic/0106-per-set-edge-style` (2026-09-04). Split out of
[epic 0089](completed/0089-flippable-edge-direction-mode.md) (2026-08-31),
see [ADR 0081](../../decisions/0081-flippable-edge-direction-sets.md). Epic
0089 has landed (PR #84), so the direction-set registry + per-edge
`directionSets` structure this hangs style on now exist. Design pass first.

## Goal

Let each edge direction set carry its own default line/marker **style**, not
just its own direction — so a diagram can draw its "Data flow" edges solid
black and its "Trigger direction" edges dashed blue without hand-styling
every edge.

## Design — see [ADR 0083](../../decisions/0083-per-set-edge-style-as-creation-template.md)

Settled with the user (2026-09-04) across three rounds. The set style is a
**creation template + the legend row's look**, not a live layer:

- **`EdgeDirectionSet.style`** (`Pick<EdgeStyle, 'stroke' | 'strokeWidth' |
  'strokeOpacity' | 'lineStyle' | 'startMarker' | 'endMarker'>`) — replaces
  ADR 0081's narrower `legend` field (widened; `color` → `stroke`). Legacy
  `legend` migrated on load.
- An edge **drawn while a set is active** is born with that set's style
  (composed over the global default-edge-style preference). Existing edges
  are **never** touched; switching sets changes direction only, exactly as
  ADR 0081 already said. So `LabeledEdge`, per-edge `directionSets`, the
  switch/save/load orientation logic, `DiagramContext` and PNG export are
  all untouched.
- The legend row (Legend panel + PNG export) is derived from the active
  set's `style` — it now genuinely matches how that reading's edges look.
- Rejected: a per-(edge, set) style, and a render-time cascade. The user
  explicitly did not want existing edges affected by a set.

## Tasks

- [x] Schema: `EdgeDirectionSet.legend` → `style` (`EdgeDirectionSetStyle`),
      widened; keep `EdgeDirectionSetLegend` as the accepted legacy shape.
- [x] `serializeDiagram` emits `style` (fixed key order), up-converting a
      legacy `legend` if it sees one.
- [x] `fromDiagramFile` runs `migrateDirectionSetStyle` (legacy `legend` →
      `style`).
- [x] `activeDirectionSetStyle()` helper; both brand-new-edge seed sites in
      `Canvas.tsx` (`onConnect`, `onConnectEnd`) merge it over
      `preferences.defaultEdgeStyle`.
- [x] `directionSetLegendRow()` sources from `style`.
- [x] `EdgeDirectionSetsSection`: row is preview + ✎ + name + duplicate +
      delete. Handler + prop renames.
- [x] `EdgeDirectionSetStyleEditor` (floating editor reusing the Property
      panel field primitives — start/end marker, colour, opacity, width,
      line style; no routing/font/metadata). `edgeStyleOptions.ts` shared.
- [x] `docs/file-format.md` Edge direction sets section updated.
- [x] `examples/gallery/data/star-schema-powerbi.chd`: `legend` → `style`.
- [x] ADR 0083.

### Follow-up round (user live-testing feedback, 2026-09-04)

- [x] **`flipEdgeVisuals` marker bug + mis-factoring** — "Reverse
      direction" on a styled edge did nothing visible (earlier: arrows on
      both ends). The helper returned only visual touch-ups (incl. a marker
      swap) that callers composed with a manual endpoint swap; the endpoint
      swap alone already reverses the arrow, so swapping markers too
      cancelled it. Replaced with `reverseEdgeDirection(edge): Edge` — one
      function that reverses the whole edge (endpoints + `points` order +
      `labelPosition`), markers untouched. `applyDirectionToEdge` uses it.
      See known-issues.md + ADR 0083.
- [x] **Eager per-set `directionSets` seeding** at edge creation (2+ sets),
      so reversing a just-drawn edge before any switch no longer bakes the
      reversal into every reading.
- [x] **Richer set-style editor** (the ✎ panel above) — the first-pass
      inline colour/width/dropdown row was too sparse.
- [ ] Live test in the app (Electron renderer — user).

## Notes

Raised as an explicit deferral during epic 0089's design pass — the user
chose to keep 0089 tight (direction only) and log this separately.

Logged deferral (ADR 0083): the per-set `strokeWidth` is not reflected in
the read-only legend swatch (panel + export), only on the real seeded edges
and the section's own editable swatch.
