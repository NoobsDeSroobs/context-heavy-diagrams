# 0106: Per-set edge style (e.g. "Trigger direction" always dashed)

## Status

Not Started — split out of [epic 0089](0089-flippable-edge-direction-mode.md)
(2026-08-31), see [ADR 0081](../../decisions/0081-flippable-edge-direction-sets.md).
Blocked on epic 0089 landing (needs the direction-set registry + the
`directionSets` per-edge structure to hang style on).

## Goal

Let each edge direction set optionally carry its own line/marker **style**,
not just its own direction — so a diagram can render "Data flow" as solid
and "Trigger direction" as dashed, or give each reading its own stroke
colour, without re-styling every edge by hand on each switch.

Epic 0089 deliberately scoped itself to direction only: marker *direction*
already follows the source/target swap for free, but a deliberately
different visual *style* per set is a separable concern.

## Open questions (not yet designed)

- **Per-set style override, or per-set-per-edge?** A whole-set default
  ("this set is dashed") is far less data and covers the motivating case;
  per-(edge, set) style is more flexible but multiplies the storage the
  same way `directionSets` already does.
- **Where does it merge in the cascade?** Today an edge's look is
  `EdgeStyle` over the hardcoded default. A per-set override would sit
  between — `set style` over `edge style` over default? Or does an explicit
  per-edge `EdgeStyle` field always win?
- **Which fields are set-overridable** — `stroke`, `lineStyle`,
  `strokeWidth`, markers, label font? Probably not `labelPosition`
  (geometry, already handled by the involution).
- **UI** — a style section in `EdgeDirectionSetsPanel`, reusing the
  existing named line-style preset picker ([ADR 0010](../../decisions/0010-named-searchable-style-presets.md)).
- **Legend interaction** — if "Trigger direction" is always dashed, should
  that convention be expressible as a Legend entry
  ([ADR 0033](../../decisions/0033-legend-catalog.md))?
- **PNG export** — export already renders whatever's active; a per-set
  style just rides along, but confirm nothing in the export path assumes a
  single `EdgeStyle` per edge.

## Notes

Raised as an explicit deferral during epic 0089's design pass — the user
chose to keep 0089 tight (direction only) and log this separately.
