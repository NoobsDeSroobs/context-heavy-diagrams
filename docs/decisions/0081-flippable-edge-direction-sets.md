# 0081: Flippable edge direction — named direction sets

## Status

Accepted (2026-08-31). Supersedes the earlier leaning design
(Derived/Independent sets grouped by `groupId`, per-set `included` flags,
connection-point-keyed identity — all dropped). Builds on
[ADR 0022](0022-unified-tag-and-metadata-system.md) (id-keyed per-element data),
[ADR 0057](0057-edge-routing-style.md) / the per-edge "Reverse direction"
action (the involution this reuses), and [ADR 0025](0025-tagging-and-overlay-visualization.md)
(split persistence — a catalog persists, a transient pointer's treatment is
decided per case).

## Context

An edge's arrow sometimes should show which way data flows, sometimes which
way an interaction is triggered/authenticated — often opposite directions
(a client polling a server: data flows server→client, the call is made
client→server). Today an edge is locked to whichever direction it was drawn.
The ask: let one diagram show either, switchably, diagram-wide.

The user cut the original design down deliberately (the five-pass version
this replaces is gone). The accepted scope:

> **Every edge exists in every set. Only the direction can swap.** The
> number-one use case is switching a single diagram between data-flow,
> invocation, and dependency readings — cases where the *same* edges are
> wanted in every version, only their arrows differ.

No per-set inclusion/exclusion. No separate edge pools. That removes the
`groupId` families, the `included` boolean, and the edge-creation dedup
problem from the model entirely.

## Decision

### Schema (`src/shared/diagram.ts`)

```ts
export interface EdgeDirectionSet {
  id: string
  name: string
  // How this reading draws in the legend (panel + PNG export) while it's
  // active — label is always `name`. Author-asserted, does NOT recolour
  // the real edges. See "Legend row".
  legend?: EdgeDirectionSetLegend
}
export interface EdgeDirectionSetLegend {
  color?: string
  lineStyle?: LineStyleKind
  startMarker?: MarkerKind
  endMarker?: MarkerKind
}

// Per-edge, per-set: which end is source, which connection point each end
// uses. The endpoint *nodes* are invariant across sets — only orientation
// and handle choice vary.
export interface EdgeDirection {
  source: string
  target: string
  sourceHandle?: string
  targetHandle?: string
}

interface DiagramEdge {
  // ...existing fields. source/target/sourceHandle/targetHandle stay — on
  // disk they always hold the BASE set's direction (see "Base orientation").
  directionSets?: Record<string, EdgeDirection>  // keyed by set id; only at 2+ sets
}

interface DiagramFile {
  // ...
  edgeDirectionSets?: EdgeDirectionSet[]      // empty => dormant
  activeEdgeDirectionSetId?: string           // which set is displayed
}
```

### One set is meaningful; two is where switching starts

- **0 sets** — feature dormant. Nothing serialized, no `directionSets` on any
  edge, an edge's direction is just its own `source`/`target`/handles.
- **1 set** — names the current reading and contributes a **legend row**
  (below). No switching, no per-edge `directionSets` (with one set an edge's
  direction *is* that set's), no base-orientation rewriting.
- **2+ sets** — per-edge `directionSets` records, base-orientation on disk,
  and diagram-wide switching all apply.

The threshold moved from "2" to "1" after the first implementation: the
user's point that a *single* named reading is worth having, because that
name is what the legend should show. `serializeDiagram` gates the registry
+ active pointer at `>= 1`, the per-edge records at `>= 2`.

### Legend row

Whenever `edgeDirectionSets` is non-empty, the **active** set contributes
one row to the legend — in both the interactive Legend panel (pinned above
the authored entries, read-only there) and the PNG export
(`buildExportLegendItems` prepends it, exactly as it already appends a row
per enabled highlight). Label = the set's `name`; swatch = an arrow drawn
from `EdgeDirectionSet.legend` (colour + line style + markers), edited in
the "Edge direction sets" section, **not** in the Legend panel. Switching
the active set swaps the row's label *and* swatch.

This is author-asserted, same standing as a hand-authored `line`
`LegendEntry` ([ADR 0033](0033-diagram-legend-design.md)) — it does **not**
recolour the real edges (per-set *edge* styling stays deferred, below). It
does not violate ADR 0033's "never auto-derived" rule: that governs the
authored *catalog editor*; the export legend has always been a composition
of authored entries + current state (enabled highlights), and the Legend
panel row is a pinned read-out, not a catalog entry.

### One shared edge, id-keyed, like everything else

Shared identity stays the edge's own `id` — never its connection points
(the mid-design catch that killed the earlier framing: dragging an endpoint
would break a connection-point-derived key). Style, label, metadata, and
bend `points` stay **single-copy on the edge**, shared by all sets. The
*only* per-set data is the `EdgeDirection` record.

### Base orientation — the on-disk canonical

`edgeDirectionSets[0]` is the **base set**. On disk:

- Each edge's top-level `source` / `target` / `sourceHandle` / `targetHandle`
  and its shared visual fields (`points` order, `style.startMarker` /
  `endMarker`, `style.labelPosition`) are always written in the base set's
  orientation — regardless of which set is active.
- `directionSets` (present only at 2+ sets) holds an `EdgeDirection` for
  **every** set, base included (the base entry is redundant with the
  top-level fields — accepted, it keeps "resolve set X" uniform: always
  `edge.directionSets[x]`).
- `activeEdgeDirectionSetId` records which set to display on load.

Consequence: **switching the displayed set never churns the edges in git** —
only the `activeEdgeDirectionSetId` line changes. Without this, every edge's
source/target would flip in the file every time someone glanced at the
diagram in the other reading. This matters because git-diff-friendliness is
a core property of the format ([ADR 0003](0003-diagram-persistence-v1.md)).

### In memory: live fields are the active set; `directionSets` is read lazily

While loaded, `edge.source/target/handles` render the **active** set —
React Flow renders straight from them, so `LabeledEdge` needs **no
changes**. `directionSets[activeId]` is allowed to go stale while the user
edits; it is only ever *read* at two moments, and refreshed from the live
fields immediately before each:

1. **Switching sets** (A → B): `refreshActive` writes `directionSets[A] =
   {live}`; then for each edge `newLive = repairHandles(directionSets[B],
   node)` — any handle id that no longer resolves to a real connection
   point falls back to `undefined` (the schema's "let the renderer pick"
   meaning; a geometric nearest isn't recoverable once the point is gone) —
   and if `newLive.source !== edge.source` (orientation flips), the
   existing **"Reverse direction" involution** is applied to the shared
   visuals (reverse `points`, `labelPosition → 1 - labelPosition`; markers
   are **not** swapped — the endpoint swap moves them on its own, see
   [ADR 0083](0083-per-set-edge-style-as-creation-template.md)); then
   `live = newLive`.

   A switch is **not itself an undo step** — it's trivially reversed from
   the panel dropdown, the same reason toggling a highlight is excluded
   from history. But the same transform is applied to every `past` /
   `future` history snapshot's edges too, so an undo after a switch doesn't
   restore a stale orientation. The switch still dirties the document (the
   active set is a persisted authoring choice). Set create / rename /
   delete likewise just dirty the document.
2. **Saving**: `refreshActive`, then if `activeId !== baseId` the same
   switch transform is run for `base` so the serialized top-level fields
   and shared visuals come out in base orientation.

**Load** is the mirror of save: top-level + shared visuals are base
orientation; `directionSets[baseId]` is seeded from them (defensively, if
the file omitted it); then if `activeEdgeDirectionSetId !== baseId` the
switch transform is applied for the active set.

`ensureDirectionSets(edges, setIds)` fills any missing `directionSets`
entry from an edge's live fields; it runs inside `refreshActive`, so an
edge created between switches (via `onConnect`, multi-connection wiring,
paste) is seeded automatically — **no direction-editing handler needs to
touch `directionSets` at all.** `onConnect`, "Reverse direction", endpoint
re-drag, `reassignConnectionPointHandles`, and the connection-point
count-change path all keep operating on the live fields exactly as today.

The transform is a true involution: A→B→A restores byte-for-byte.

### New edges

`onConnect` and multi-connection wiring seed **every** set's
`directionSets` entry with the drawn direction, so no set is ever caught
without a record (the "fallback should structurally never fire" point
from the original design).

### Set management

An **"Edge direction sets" `CollapsibleSection` in `DiagramSettingsPanel`**
— next to "Required tags" and "Line bend presets", consistent with
[ADR 0071](0071-consolidate-diagram-configuration-panel.md)'s consolidation
(a standalone 9th mutually-exclusive dock panel was considered and rejected
for the same reason ADR 0071 folded the other two in). `edgeDirectionSets`
+ `activeEdgeDirectionSetId` are pure per-diagram state, which is exactly
what `DiagramSettingsPanel` is "the single home for". No new View-menu
item, no new dock toggle. The section holds (at 2+ sets) an active-set
`<select>`, and per set: an inline name field, a swatch button (opens the
existing `StylePicker` for line style / markers) + a colour input for the
legend row, Duplicate, Delete. Plus an "Add direction set" button, usable
from zero sets.

- **New**: appends a set (records, at 2+ sets, copied from the active
  set); legend seeded to a default red arrow.
- **Duplicate**: same, copying the chosen set's records *and* legend.
- **Rename**: display-only (`name`), no per-edge migration — records are
  keyed by `id`. The name is also the legend row's label.
- **Delete**: removes the set from the registry, and (at 2+ sets) its key
  from every edge's `directionSets`. Allowed down to zero. Deleting the
  active set switches to the first remaining set first (re-orienting the
  live edges); dropping to one set or none strips every per-edge record.
  Deleting the base set promotes the next set to index 0; save-time
  normalisation picks up the new base with no eager rewrite. No
  orphan-preservation step — an `EdgeDirection` is fully app-derived data,
  nothing a human typed (contrast the required-tag rename bug in
  known-issues.md).

### Persistence / dormancy

Additive, **no version bump**. A `.chd` with no `edgeDirectionSets`
behaves exactly as today. `serializeDiagram` emits `edgeDirectionSets` +
`activeEdgeDirectionSetId` **when `length >= 1`** (a single set carries its
name + legend styling), and per-edge `directionSets` **only when
`length >= 2`**. Crossing 1→2 materialises `directionSets` for every edge
from its current live direction; dropping 2→1 (or →0) strips them again.

Diagram-level data, not a Setting ([ADR 0052](0052-settings-ownership-tiers.md)) —
the registry and the active pointer are per-diagram.

Unlike [ADR 0025](0025-tagging-and-overlay-visualization.md)'s split
persistence, the active-set pointer **is** persisted: which reading a
diagram opens in is a deliberate authoring choice, not transient UI state,
and (thanks to base orientation) persisting it costs one line in the file.

## Alternatives considered

- **Flip-only boolean per (edge, set)** instead of a full `EdgeDirection`
  record. Less storage, and connection-point reassignment code stays
  untouched. Rejected: no per-set connection-point choice, and dragging an
  endpoint while a non-base set is active needs special logic to decide
  whether the boolean also flips. The full record makes a switch "write
  four fields" and makes an endpoint drag "mirror live into the active
  record" — no derived-reverse reasoning anywhere.
- **Top-level edge fields follow the *active* set on disk** (no base
  orientation). Simpler save path, but every edge churns in git whenever
  the displayed reading changes — including just browsing. Rejected for the
  format's diff-friendliness.
- **`directionSets` excludes the active set** (active lives only in the
  top-level fields). Avoids storing the active record twice. Rejected:
  makes "resolve set X" branch on whether X is active, and switching sets
  churns `directionSets` content (remove one key, add another) on top of
  the top-level flip. Storing every set uniformly keeps switches to a
  one-line diff and every set equal.
- **Derived/Independent set families with `groupId`** (the prior leaning
  design). Handles asymmetric business-mapping cases where two readings
  genuinely need different edges. Rejected by the user: the dominant use
  case has identical edges in every reading, and the family machinery is a
  large amount of model complexity for the minority case. A diagram that
  truly needs different edge pools can use two diagrams.
- **Per-set styling of the real edges** ("Trigger direction" draws every
  edge dashed on the canvas). Deferred at the time; later done as a
  per-reading *creation-time default* — see
  [ADR 0083](0083-per-set-edge-style-as-creation-template.md). Note this is
  *not* the same as the per-set **legend** swatch (colour + line style +
  markers) that shipped here — that only styles the one legend row, never
  the edges.
- **Edge-creation dedup** ("this edge already exists, just hidden").
  Dropped — the "hidden in another set" state no longer exists, this app
  intentionally allows parallel edges, and a connection-point-pair
  heuristic risks collapsing deliberately-distinct edges.

## Consequences

- `LabeledEdge` unchanged — markers/direction already render from live
  source/target.
- New surface in `Canvas.tsx`: switch-set action + load/save orientation
  normalisation. Direction-editing handlers are **untouched** — `directionSets`
  is refreshed from live fields at switch/save time, not mirrored per-edit.
- New shared module (`renderer/src/edges/edgeDirectionSets.ts`):
  `refreshActiveDirectionSet`, `ensureDirectionSets`, `switchActiveDirectionSet`,
  `applyDirectionToEdge` (repair + involution), `repairDirection`,
  `flipEdgeVisuals` (the extracted involution, also used by "Reverse
  direction" — later corrected + renamed `reverseEdgeDirection`, see
  [ADR 0083](0083-per-set-edge-style-as-creation-template.md): it must not
  swap the markers, only the endpoints + `points`/`labelPosition`),
  `stripDirectionSets` / `removeDirectionSetKey` /
  `addDirectionSetFrom`, and `directionSetLegendRow`.
- `docs/file-format.md` updated: `EdgeDirectionSet` (+ `legend`),
  `EdgeDirection`, `DiagramFile.edgeDirectionSets` /
  `activeEdgeDirectionSetId`, `DiagramEdge.directionSets`, base orientation,
  and the one-set legend behaviour.
- Legend row plumbed through `buildExportLegendItems` (new
  `directionSetRow` param) and `LegendPanel` (new `directionSetRow` prop,
  rendered pinned + read-only). `hasLegendContent` (export dialog) counts
  it.
- New `EdgeDirectionSetsSection` component + a `CollapsibleSection` slot
  in `DiagramSettingsPanel`; CSS reusing `.required-tag-value-*` plus a
  small swatch/colour control and `.legend-row-pinned`.
- Open, accepted as future work: what a `(edgeId, setId)` record should do
  if its endpoint *node* is deleted — for now it is removed with the edge,
  same as any edge cleanup, since the node pair is invariant across sets.
