# 0178: Edge ends with no connection point attach themselves

## Status
Accepted (2026-11-15)
Supersedes: none
Superseded by: [0200](0200-a-drop-on-empty-canvas-makes-an-entity-with-an-automatic-end.md), for a drop on empty canvas only

## Context
An edge end names a connection point (`sourceHandle` / `targetHandle`). An end that names none used to be drawn at the element's first point, the top, whatever the other element's place, and the person had to move every edge by hand when elements were rearranged. The file format already says an absent handle means "let the renderer pick".

## Decision
- **An end with no handle is automatic.** The renderer, the exports and the layout checks pick its place from where the two elements are, every time, so it follows them as they move. Nothing is stored for it.
- **Side:** the side that faces the other element, across the wider gap, towards where that element is. Where the gaps are within 24 px of each other the edge keeps the axis it had, so one that is nearly diagonal does not flip while an element is dragged. Elements that overlap, an edge to itself and an unknown element keep the old fallback, the first point.
- **Point:** among the points the side has, ones no edge names first, in the order of where the other ends are along the side, each on the one nearest to where its other end is. With no free point left the edges share, in order. The set of points stays the person's choice ([0175](0175-assistants-make-what-a-person-can-make.md)); this picks among them. The small slide that straightens an edge applies as to any other ([0176](0176-connection-points-slide-a-little-to-straighten-edges.md)).
- **Making one:** drop a connection on the dashed target that appears in the middle of an element while a connection is dragged; or right-click an edge and choose **Attach automatically**. **Fix to current points** writes the points an edge now uses and makes it fixed. An edge dropped on a point is fixed, as before. Dropping on empty canvas makes an entity; its end is automatic too ([0200](0200-a-drop-on-empty-canvas-makes-an-entity-with-an-automatic-end.md)).
- **For assistants:** `connect` and `set_edge_handles` take `"auto"` for a handle (a point cannot be named `auto`). `route_edges` writes the points an automatic edge took, since its bend points are absolute ([0177](0177-route-edges-chooses-the-connection-points-it-routes-from.md)).
- **Files:** no new field. An existing edge with no handle now attaches itself instead of leaving by the top; that is the one visible change to old files.

## Alternatives considered
- **A stored flag per end** (fixed or automatic): the absent handle already says it, and a flag could contradict a handle.
- **Choosing the point by cost, so an edge avoids crossings:** needs the routing of every edge on every drag frame; the facing side and order is cheap and what a person does first.
- **Virtual points for automatic edges** (spacing the side for them as well as the stored points): would move fixed points, which are stored.
- **Making every edge automatic:** a person who placed an edge on a point meant it.

## Consequences
- Rearranging elements keeps automatic edges tidy with no work.
- A side with one point, which is every side by default, shares it among its automatic edges: they fan from the middle until the person adds points, and then spread over them.
- Edges with bend points of their own are not routed again when an end moves: an automatic edge that is routed (`route_edges`) is written with its points named, and one a person gave bend points keeps them where they are.
- Not covered in the first version: no mark on an automatic end beyond the dashed target while connecting; the dashed preview line while dragging a connection ignores automatic ends.
