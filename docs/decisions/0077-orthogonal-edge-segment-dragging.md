# 0077: Draggable segments for step / smoothstep edge routing

## Status
Accepted (2026-08-30). Builds on [ADR 0057](0057-edge-routing-style.md)
(routing style as a style field; `DiagramEdge.points` for manual bend points).

## Context

`EdgeStyle.routingStyle` has offered `step` / `smoothstep` (right-angled, and
right-angled-with-rounded-corners) since [ADR 0057](0057-edge-routing-style.md),
but with **no manual control** — the path was whatever React Flow's
`getSmoothStepPath` computed from the two endpoints. Only `catmullRom` routing
lets the user shape the path, via `DiagramEdge.points` (interior control points,
dragged with per-point handles, added/removed from a right-click menu, each with
a Catmull-Rom `gravity`).

The user wants to pull a step/smoothstep edge's **segments** into position — the
draw.io / React Flow Pro "Editable Edge" interaction. React Flow's core path
functions can't do this (they only compute a static path from source + target,
no interior points); the Pro example is a bespoke edge component. So this is a
build, not a wiring job.

The explicit constraint from the user: **the step/smoothstep work must not be
able to regress `catmullRom`.** A fiddly orthogonal-routing bug must stay
contained to orthogonal routing.

## Decision

### Isolation

New module `src/renderer/src/geometry/orthogonalPath.ts`, with **no dependency
on `bendablePath.ts`** (the Catmull-Rom module). The two routing families share
exactly one thing: the persisted `DiagramEdge.points` array shape. No shared
code, so a change to one cannot break the other. In `LabeledEdge.tsx` the
`step` / `smoothstep` cases of the `edgePath` switch and a new, separately-gated
segment-handle render block are the only additions; the `catmullRom` and
default-bezier branches are untouched, as is `bendablePath.ts`.

### `points` reinterpreted per routing style

`DiagramEdge.points` under `step` / `smoothstep` = **orthogonal waypoints** the
right-angled path is forced through. `gravity` is not read (and need not be
present). An on-disk `gravity` from a previous `catmullRom` life is preserved,
not stripped — switching routing style stays lossless. Purely additive; no
`.chd` version bump ([ADR 0029](0029-backward-compatible-loading-is-a-standing-rule.md)).

### This app renders the orthogonal path, not React Flow

`step` / `smoothstep` now always route through `orthogonalPath.ts`, replacing
the `getSmoothStepPath` call. `getSmoothStepPath`'s common-case output (a
centred crossbar between facing sides, a single corner for perpendicular sides)
is reproduced by `defaultVertices()`; `smoothstep`'s rounded corners use the
same `borderRadius` (5) via a quadratic, same as React Flow. **Consequence:**
pristine, never-edited step/smoothstep edges may render marginally differently
from before for unusual geometry (near-overlapping or overlapping nodes, where
`getSmoothStepPath` has extra offset heuristics this router doesn't). Accepted:
the alternative (React Flow's path until the first waypoint, then ours) means
the drag handle can't be guaranteed to sit on the visible line and there's a
visible path "jump" on the first edit.

### Segment dragging — v1 scope line

A drag handle is shown at the midpoint of each **interior** segment — one whose
two ends are both bend vertices, never the edge's fixed source or target.
Dragging moves the whole segment along its normal; corners stay at 90°. Under
the hood the frozen expanded-vertex list is transformed and the interior
vertices become the new `points`; the result is simplified (redundant collinear
corners dropped) only on pointer-up, so the segment index a gesture holds stays
valid throughout.

**Endpoint-adjacent segments are not draggable in v1.** Moving a segment
attached to a fixed endpoint requires synthesising a perpendicular stub so the
endpoint stays put — that is where the fiddliness and the regression risk live.
The common case — the mid crossbar of a step edge between two shapes that face
each other — *is* an interior segment, so it works out of the box. An L-shaped
edge (perpendicular sides, no interior segment) has no draggable segment until
the user adds a waypoint. `moveOrthogonalSegment`'s stub branches are written
and correct but currently unreachable from the UI, kept as a foundation if v2
lifts this line.

### Adding / removing waypoints

"Add point here" on the edge context menu, previously a hard-coded switch to
`catmullRom`, now keeps `step` / `smoothstep` routing and inserts an orthogonal
waypoint in the nearest gap. Explicit point *removal* has no menu item for
orthogonal edges in v1 — dragging a segment back into line with its neighbours
auto-drops the now-redundant waypoints on release (the pointer-up simplify
pass), which covers the need without new UI.

## Alternatives considered

- **Reuse the catmull-rom per-vertex handles for step** (make step route
  through `points` as a plain polyline, keep the existing vertex drag +
  right-click add/remove). Smaller, but vertex-dragging an orthogonal path is
  clunky and it isn't the *segment* interaction the user asked for.
- **Auto-convert a step edge to `catmullRom` on first drag.** Cheapest; throws
  away the right-angle look that is the whole reason to pick step routing.
  Rejected.
- **Full draggable end-segments with stub synthesis, in v1.** The complete
  draw.io model. Deferred, not rejected — the endpoint-adjacent case is the
  fiddly part and the user pre-approved postponing it (as its own follow-up)
  rather than risk the rest.

## Consequences

- `.chd` version stays `1`. `docs/file-format.md`'s `Edge points` section
  updated: `points` is now meaningful under `step` / `smoothstep` too, as
  orthogonal waypoints, `gravity` unused.
- `getSmoothStepPath` is no longer used anywhere; `LabeledEdge.tsx` drops the
  import.
- New CSS: `.edge-segment-handle` (+ `-h` / `-v` cursor variants).
- Follow-up worth its own epic if wanted: draggable endpoint-adjacent segments
  (stub synthesis), and an explicit "remove waypoint" affordance for orthogonal
  edges.
