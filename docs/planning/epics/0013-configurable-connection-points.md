# 0013: Configurable connection points

## Status
Not Started

## Goal
Beyond the default 4 fixed connection points per `ShapeNode` (one per side, centered — built in epic 0002), let users add more. Motivated by real need: shapes with many integrations/dependencies need more attachment points than 4 to avoid edges overlapping/crossing at the same point. Raised during epic 0002 design discussion but deliberately not part of that epic's scope.

## Tasks
- [ ] Schema: per-node connection point list (`{ side: 'top'|'right'|'bottom'|'left', offset: number }`, offset = 0–1 fraction along that side), additive to `DiagramNode`, defaulting to the existing 4 centered points when absent — no change for shapes nobody customizes
- [ ] "Add connection point here": extends the right-click context menu (epic 0008 adds "See details" to this same menu) with a new entry, computing the nearest side + offset from where the user right-clicked
- [ ] Position handles via percentage offset along their side (not raw pixels) so they survive resize automatically
- [ ] Removing a point (explicitly lower priority than adding — can land in a later pass): right-click an existing non-default point → remove. If it has an edge attached: **disconnect and leave the edge with a dangling free endpoint** if React Flow's data model can represent that; **if not practical, block the removal instead**. Deliberately not "delete the edge" — deleting risks losing information written on the edge itself (see epic 0012's edge labels). Default points (the original 4) are not removable.

## Notes
Same split-out-from-0002 situation as epic 0012 — see that epic's notes.
