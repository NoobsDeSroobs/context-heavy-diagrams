# 0013: Configurable connection points

## Status
Done — the interactive test flagged at merge time was never explicitly re-confirmed as its own item, but connection points have been exercised constantly through dozens of subsequent epics with no issue ever reported against them. See Notes.

## Goal
Beyond the default 4 fixed connection points per `ShapeNode` (one per side, centered — built in epic 0002), let users add more. Motivated by real need: shapes with many integrations/dependencies need more attachment points than 4 to avoid edges overlapping/crossing at the same point. Raised during epic 0002 design discussion but deliberately not part of that epic's scope.

## Tasks
- [x] Schema: per-node connection point list (`{ id, side: 'top'|'right'|'bottom'|'left', offset: number }`, offset = 0–1 fraction along that side), additive to `DiagramNode` (top-level, sibling to `data` — same file-schema/React-Flow-state split as `rotation`, since React Flow's `Node` type has no room outside `data`). Absent/empty means just the 4 defaults — no change for shapes nobody customizes.
- [x] "Add connection point here": extends the right-click context menu with a new entry, computing the nearest side + offset from where the user right-clicked (`nearestConnectionPoint` in `ShapeNode.tsx` — simple nearest-edge-distance comparison against the shape's own bounding rect).
- [x] Position handles via percentage offset along their side (not raw pixels) so they survive resize automatically — `style={{ left/top: '<offset*100>%' }}` layered on top of React Flow's `position={Position.*}`, which still centers the 4 defaults for free with no override needed.
- [x] Removing a point: right-click an *existing custom point directly* (not the shape generally) shows "Remove connection point," `stopPropagation`-ed so it doesn't also trigger the shape's add-menu. Resolved the "dangling endpoint vs. block" question from the original scoping: React Flow's `Edge` type requires both `source` and `target` to be valid node ids — there's no way to represent a half-connected/dangling edge in its data model, so removal is **blocked** (a clear alert) whenever the point has an edge attached, never "disconnect and dangle." Default points aren't removable at all (they're not represented in `connectionPoints`, so there's nothing to attach a remove handler to for them). See [ADR 0021](../../decisions/0021-connection-point-removal-blocked.md), which also flags an unresolved tension with epic 0014's later `AnchorNode` — that ADR itself points back here.

## Notes
Same split-out-from-0002 situation as epic 0012 — see that epic's notes.

Distinct from epic 0003's arrow marker styling (what an edge's end looks like — arrowhead, crow's-foot, diamond, etc., see [ADR 0010](../../decisions/0010-named-searchable-style-presets.md)). This epic is only about *where on a shape* an edge can attach, not what it looks like once it does — easy to conflate since both surfaced around the same "arrow ends" conversation.

`docs/file-format.md` updated with the new `connectionPoints` field and the expanded `sourceHandle`/`targetHandle` meaning. `npm run typecheck`/`lint` clean (no new errors vs. baseline), app launches. **Not independently verified**: actually dragging an edge to/from a custom point, right-clicking precisely on a small Handle element to remove it, and whether a point visually survives a resize as expected — all genuinely visual/interactive, and per your steer after epic 0018, that's yours to check rather than something worth fighting slow/unreliable browser automation for.
