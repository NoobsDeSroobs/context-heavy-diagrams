# 0047: Forced straight segment near edge endpoints

## Status
Not Started — not yet scoped. Raised by the user (2026-08-20). Deliberately not designed here, just captured so it isn't lost, same as epics 0024/0026/0030/0037-0046. Explicitly told not to build yet.

## Goal
Force every edge to travel straight outward from each endpoint for a configurable number of pixels (the user's own suggestion: 5-10px, adjustable in an options/settings menu) before curving toward the other end — rather than curving immediately from the connection point, which reads badly for steep inclines or near-horizontal connections. A default-routing improvement, not manual control over the whole path.

## Relevant existing behavior
Every edge is currently a single path computed end-to-end by React Flow's `getBezierPath` (`LabeledEdge.tsx`) — no concept of a forced initial straight run at either end.

## Relationship to epic 0032
[Epic 0032](0032-edge-routing-and-waypoints.md) (also unscoped) covers *manual* edge routing — user-placed waypoints with vector controls, steering an edge around obstacles by hand. This request is different in kind: a *default rendering behavior* applied automatically to every edge, with one configurable number (the straight-segment length), not a per-edge manual authoring tool. Worth keeping these separate rather than folding this into 0032's scope — 0032's own framing is explicitly about manual placement, and mixing in an always-on automatic default would muddy that. That said, if 0032 ever gets a real design pass, whoever does it should check whether a shared path-building mechanism could serve both rather than building two separate piecewise-path implementations in `LabeledEdge.tsx`.

## Real open questions (deliberately not resolved here)
- **Where the setting lives** — the user says "an options menu," implying an app-wide/global default rather than a per-edge property panel field. Worth confirming: does every edge get the same forced-straight length uniformly, or is it still overridable per edge/per diagram? A single global default is simpler; per-edge override is more flexible but is real added scope.
- **Interaction with `lineStyle`/markers** — a forced straight lead-in changes where a start/end marker (arrowhead, etc.) actually points relative to the node it's leaving/entering; worth checking this doesn't look wrong for the crow's-foot/diamond marker styles already supported (`docs/file-format.md`'s Edge style marker kinds).
- **Rendering approach** — likely needs a piecewise path (straight segment + curve) built manually rather than one call to `getBezierPath`, similar to what epic 0032 would also need for waypoints — see the cross-reference above.

## Notes
Not scheduled into the current batch (see [PROGRESS.md](../../../PROGRESS.md)) — flagged here so it's on the backlog and not lost, not because it's next up.
