# 0177: `route_edges` chooses the connection points it routes from

## Status
Accepted (2026-11-15)
Amends: [0174](0174-route-edges-is-an-edit-operation-that-draws-edges-only.md), which left connection points alone.
Superseded by: none

## Context
Where an edge attaches decides most of how it looks: on the trial diagrams the best picture had each edge on its own point on the side facing its other end, so edges run straight and do not fan. An assistant could only do that by adding many points and moving edges to them, and its offsets would not look like a person's ([0175](0175-assistants-make-what-a-person-can-make.md)).

## Decision
- **`route_edges` also chooses the points of the edges it routes**, unless called with `connectionPoints: "keep"`. For each such edge it takes the side of each element that faces the other (across the wider gap, towards where the other element is; where the two overlap, the sides it has), and gives it a connection point of its own there.
- **Order, then even spacing.** On a side the edges take their points in the order of where their other ends are along the side, so they do not cross at the element. Points that other, unrouted edges use stay and keep their order; the routed ends go in among them. The side's points are then spaced evenly, as the app does. No offset is ever set by the tool; the small slide that lines edges up is left to [0176](0176-connection-points-slide-a-little-to-straighten-edges.md).
- **Tidy sides.** A side it rebuilds loses points no edge uses; a side left with only its centre point stores nothing. Ids are reused, so running it twice changes nothing.
- **At the limit** (the diagram's `maxConnectionPointsPerSide`, else 12) the closest chosen edges share a point, and the answer says so.
- **Routes are drawn from the slots.** A routed edge has bend points of its own, so its ends sit in their slots (nothing pulls it); the router uses those. An edge with bend points that is not routed but whose end moved with its side is routed again, since its old route no longer fits.
- **An edge that cannot be routed** goes back to its old points: the passes run again without it. If that fails too, it keeps its new points, loses its stale bend points and is named in the answer.

## Alternatives considered
- **Choosing the side by the cheapest route** (try the four sides at each end, keep the best): finds better sides where the facing ones are blocked, at up to sixteen times the work per edge. The facing rule is what a person does first; this stays open.
- **A separate operation:** two calls for what is one decision, and a route found before the points move is wrong after.
- **Keep as the default:** leaves the trial runs' problem, an assistant that does not think to move edges onto points.

## Consequences
- An assistant gets one edge per point and straight, ordered fans from one call, and a diagram that looks like one a person made.
- It changes an element's points and unrouted edges' ends when it respaces a side; the routed edges are drawn again for that reason.
- Not covered: edges to containers, and elements whose sides all lead into a crowded gap.
