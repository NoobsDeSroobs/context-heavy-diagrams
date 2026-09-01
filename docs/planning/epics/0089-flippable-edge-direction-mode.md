# 0089: Flippable edge direction — data flow vs. invoker/trigger direction

## Status
In progress — design committed 2026-08-31, see [ADR 0081](../../decisions/0081-flippable-edge-direction-sets.md). On `epic/0089-flippable-edge-direction`.

## Goal
Sometimes an edge's arrow should show the direction data actually flows;
sometimes it should show who authenticates/triggers the interaction (often
the *opposite* direction — a client polling a server is data flowing
server→client but triggered client→server). Let one diagram show either,
switchably, diagram-wide — not locked to whichever was drawn.

## Committed design (2026-08-31)
Full rationale and the rejected alternatives are in
[ADR 0081](../../decisions/0081-flippable-edge-direction-sets.md). Summary:

- **Every edge exists in every set; only the direction can swap.** The
  user's explicit simplification — no per-set inclusion/exclusion, no
  separate edge pools, no `groupId` families, no edge-creation dedup. The
  #1 use case (one diagram switched between data-flow / invocation /
  dependency readings) wants the same edges in every version.
- **Schema**: `DiagramFile.edgeDirectionSets: { id, name }[]` +
  `activeEdgeDirectionSetId`; `DiagramEdge.directionSets: Record<setId,
  EdgeDirection>` where `EdgeDirection = { source, target, sourceHandle?,
  targetHandle? }`. Endpoint *nodes* are invariant across sets — only
  orientation and connection-point choice vary.
- **Base orientation** — `edgeDirectionSets[0]` is canonical on disk. Each
  edge's top-level `source`/`target`/handles and shared visuals
  (`points` order, start/end markers, `labelPosition`) are always written
  in the base set's orientation, so **switching the displayed set never
  churns edges in git** — only `activeEdgeDirectionSetId` changes.
- **In-memory invariant**: live `edge.source/target/handles` always equal
  `edge.directionSets[activeEdgeDirectionSetId]`. `LabeledEdge` needs no
  changes (markers already derive from which end is source at render).
- **Switch to set X**: snapshot; `refreshActive` (write live → the
  outgoing set's records + `ensureDirectionSets` for any new edges); per
  edge, repair `directionSets[X]`'s handles (stale connection-point id →
  nearest surviving point), and if orientation flips vs. current live,
  apply the existing "Reverse direction" involution to the shared visuals
  (reverse `points`, swap markers, `labelPosition → 1 - x`); then set live
  `= directionSets[X]`.
- **`directionSets` is read only at switch and save**, refreshed from the
  live fields immediately before each. It may be stale in between —
  **no direction-editing handler touches it**. "Reverse direction",
  endpoint drags, connection-point remove/count-change all keep operating
  on the live fields exactly as today.
- **New edges** get seeded automatically by `ensureDirectionSets` at the
  next switch/save — `onConnect` etc. need no changes.
- **UI**: an "Edge direction sets" `CollapsibleSection` in
  `DiagramSettingsPanel` (next to Required tags / Line bend presets, per
  [ADR 0071](../../decisions/0071-consolidate-diagram-configuration-panel.md)'s
  consolidation — no new dock panel, no new View item) — per-set name +
  legend swatch (colour + `StylePicker` line style/markers), Duplicate,
  Delete; an active-set `<select>` at 2+ sets; "Add direction set" usable
  from zero.
- **Legend** (2026-08-31 follow-up): a direction set is meaningful from the
  **first** one — its name (+ per-set swatch styling) becomes a legend row
  shown in the interactive Legend panel (pinned, read-only) *and* prepended
  to the PNG export legend (same as enabled-highlight rows already are).
  Switching the active set swaps the row. Dormancy threshold dropped from
  "2 sets" to "1"; per-edge `directionSets` + base orientation still only
  at 2+.
- **Dormant until used**: additive, no version bump. `serializeDiagram`
  emits the new fields only when `edgeDirectionSets.length >= 2`. Creating
  a second set materialises `directionSets` for every edge; deleting back
  to one set drops them.
- **Deferred**: per-set line/marker *style* → [epic 0106](0106-per-set-edge-style.md).

## Tasks
- [x] `src/shared/diagram.ts`: add `EdgeDirectionSet`, `EdgeDirection`,
      `DiagramFile.edgeDirectionSets` / `activeEdgeDirectionSetId`,
      `DiagramEdge.directionSets`; `serializeDiagram` gated emission
      (`length >= 2`), deterministic key order.
- [x] `docs/file-format.md` — new fields + base-orientation rule.
- [x] New `renderer/src/edges/edgeDirectionSets.ts`: `flipEdgeVisuals`
      (extracted from `Canvas.tsx`'s inline "Reverse direction" handler),
      `repairDirection`, `applyDirectionToEdge`, `ensureDirectionSets`,
      `refreshActiveDirectionSet`, `switchActiveDirectionSet`,
      `stripDirectionSets`, `removeDirectionSetKey`, `addDirectionSetFrom`.
- [x] `Canvas.tsx` load path (`fromDiagramFile`): seed missing records from
      the base fields, apply `active` if `active !== base`.
- [x] `Canvas.tsx` save path (`toDiagramFile`): `refreshActiveDirectionSet`
      + normalise live orientation back to base before serialising; thread
      `edgeDirectionSets` / `activeEdgeDirectionSetId` through all 3
      `toDiagramFile` call sites + `fromDiagramFile` + `loadDiagramIntoCanvas`.
- [x] Switch-active-set action + `rewriteHistoryEdges` (rewrites live edges
      + every `past`/`future` snapshot; not itself an undo step).
- [x] `"Reverse direction"` handler re-expressed via `flipEdgeVisuals`.
- [x] `EdgeDirectionSetsSection` component + `CollapsibleSection` slot in
      `DiagramSettingsPanel`; state + handlers threaded from `Canvas.tsx`.
- [x] New/Rename/Duplicate/Delete set operations (base-set promotion on
      delete, active-set fallback, drop `directionSets` back to one set).
- [x] `remapForPaste` strips `directionSets` (stale node refs) — re-seeds.
- [x] Legend row: `EdgeDirectionSet.legend` schema; `directionSetLegendRow`
      helper; `buildExportLegendItems` + `LegendPanel` + `hasLegendContent`
      wired; `EdgeDirectionSetsSection` gains swatch colour + `StylePicker`.
      Dormancy threshold 2 → 1 across serialize / `fromDiagramFile` /
      handlers.
- [ ] CSS: `.edge-direction-set-*` + `.legend-row-pinned` added; check
      row spacing (swatch + colour + name + 2 buttons in a ~260px panel)
      and the pinned row divider on a real run.
- [x] `typecheck` clean; `lint` 0 errors (CRLF warnings only, pre-existing).
- [ ] Live-test (Electron): create sets, switch, reverse in one set, drag an
      endpoint per set, delete a connection point then switch, save/reload
      round-trip, dormant→2 sets→dormant.
- [x] Worked example: `examples/gallery/data/star-schema-powerbi.chd` — a
      Power BI star schema whose relationships carry a "Cardinality (1 to *)"
      and a "Filter direction" set (part of epic 0022's gallery; also the
      concrete showcase for this feature). Serialize round-trip verified;
      not yet opened in-app.

---

## Design history (superseded — kept for the record)

### Superseded pass 5: Derived vs. Independent sets, grouped by `groupId`
Two explicit kinds of set (Derived: locked to the same edges as its family,
differing only in direction; Independent: its own edge pool), with an
integer `groupId` marking families. **Superseded by ADR 0081** — the user
decided the dominant use case has identical edges in every reading, so the
family machinery isn't worth its model complexity; a diagram that truly
needs different edge pools uses two diagrams.

### Superseded pass 4: the `included`-flag/filtering approach
One canonical edge per logical connection with a per-(edge, set) `included`
boolean, filtered at render time. Superseded first by pass 5, then by
ADR 0081.

### The identity-key problem (still relevant, resolved the same way)
If a shared edge's identity were keyed by *which connection points it
touches*, dragging an endpoint breaks its own key — forcing a re-key (other
sets lose it) or a duplicate entry (unbounded bloat, properties no longer
shared). **Resolution, carried into ADR 0081**: keep the edge's own stable
`id` as identity, exactly like required tags / style / metadata; the per-set
data is a plain `{source, target, sourceHandle, targetHandle}` record keyed
by set id.

### Open questions from the leaning design — how ADR 0081 answers them
- *Partial exclusion within a family?* — Gone. Every edge is in every set by
  construction.
- *Stale `connectionPointId` after a point is deleted/renumbered?* — Lazy
  repair: snap to the nearest surviving point at switch/load time.
- *Does a new edge need a real record for every set immediately?* — Yes,
  `onConnect` / multi-connection seed all sets. No fallback net in normal
  operation.
- *Where does the set-management UI live?* — A dedicated `UtilityDock`
  panel now (same as gravity presets / style palettes); placement can be
  revisited with epic 0074's palette selector later.
- *Copy a set: same records or blank?* — Same (there is no valid blank —
  every edge must have a direction).
- *Diagram-level, not a Setting?* — Confirmed ([ADR 0052]).
- *Per-set marker/line style?* — Deferred to [epic 0106](0106-per-set-edge-style.md).

## Notes
Raised by the user 2026-08-24, refined across five passes that day, then cut
down and committed 2026-08-31 (this session): the user chose the simple
model — all edges in all sets, only direction swaps — over the
Derived/Independent design, on the reasoning that data-flow vs. invocation
vs. dependency diagrams all want the identical edge set. **Not** the same as
epic 0084's already-shipped per-edge "Reverse direction" (a one-off flip);
this is the switchable diagram-wide version, and it *reuses* 0084's
involution transform as its per-edge primitive.
