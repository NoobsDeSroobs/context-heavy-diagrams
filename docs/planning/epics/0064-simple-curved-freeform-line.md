# 0064: Simple curved freeform line (bezier)

## Status
Not Started — not yet scoped. Split out of [epic 0051](0051-non-rectangular-shapes-and-new-item-categories.md) (2026-08-22): that epic originally bundled this with shape variety and a large-icon category, but the user identified this piece as actually needed soon (trust-boundary lines for threat-modeling diagrams — see [epic 0060](0060-threat-risk-matrix.md)), while the rest of 0051 is not. Split so this can move ahead of the others without waiting on the larger, more speculative shape-variety/iconography work.

## Goal
A simple curved freeform line as a new top-level item category, distinct from edges (which always connect two node endpoints). Deliberately scoped down from 0051's original "freeform, bendable lines" idea: a single bezier curve (start point, end point, one or two control points) rather than an arbitrarily bendable multi-segment line. The immediate driver is drawing trust-boundary lines in threat-model-style diagrams — a curve that can be placed and shaped independently of any node, not anchored to two connection points the way an edge is.

## Real open questions (deliberately not resolved here)
- **Exact curve model** — a single quadratic/cubic bezier (2-4 points) is probably enough for the stated need; confirm before building whether anything more elaborate is actually required for trust-boundary use, or whether that's exactly the "rest is not needed" the user drew the line at.
- **Relationship to [epic 0032](0032-edge-routing-and-waypoints.md)** (edges gaining manual waypoints/bias offsets) — still worth checking before designing, per 0051's original note: 0032's waypoint mechanism might be directly reusable here, even though this item isn't anchored to two node endpoints the way an edge is.
- **Styling** — does it reuse the existing edge style system (stroke color/width/dash, per epic 0003/ADR 0010) or need its own? Reuse seems likely given the visual similarity to an edge, just without endpoints.
- **Selection/resize/rotate interaction** — how do you grab and reshape a freeform curve after placing it? Doesn't map cleanly onto the existing node resize-handle model (epic 0002/0044) or the edge reconnect-handle model (epic 0033) — probably needs its own interaction, closer to per-control-point dragging.
- **Where it lives in the item palette** (`ItemPalette.tsx`) — its own top-level category, as 0051 originally assumed, or grouped with edges since it's conceptually closer to a line than a node?

## Notes
Not scheduled into any current batch yet — logged the same day it was split out. See [PROGRESS.md](../../../PROGRESS.md) for current batch sequencing.
