# 0191: Right-angled edges leave and arrive by their side, and every segment can be dragged

## Status
Accepted (2026-11-19)
Amends: [0077](0077-orthogonal-edge-segment-dragging.md) (which offered handles only on the segments between two bends, and left the segments touching the source or the target for later).
Superseded by: none

## Context
A step or smooth step edge with one point above two facing elements went up and straight back down the same line, a spike, because the route ignored which side of an element the edge is attached to. A straight edge, or one with a point on its line, had nothing to grab: handles sat only on the segments between bends, so shaping an edge round two elements took two points added by right-click, and the second never showed a handle until something else made a bend.

## Decision
- **The route leaves the source along the side it is attached to, and arrives along the target's side.** When the leg to the first waypoint, or from the last, would run back into the element it joins, the route first takes a stub of 20 straight out of the element (or into it) and turns there. One point above two facing elements now goes round both. A leg already in line with the end is left straight, even through the element: a straight line, or a point on it, is what was drawn, and with no point at all that is the default.
- **Every straight segment gets a drag handle,** the ones touching the source or the target included, when it runs along the side that end is attached to and is at least 40 long (room for a stub besides). The stubs themselves are too short to grab.
- **Dragging a segment that touches an end moves it along its normal and the edge leaves the element by a stub,** turning onto the moved segment at the stub's end. Dragging the one segment of a straight edge makes a stub at each end, so a backwards connection goes round both elements in one drag. Dragging it back onto its line, within a few units, takes the points away again.
- **A straight run has one handle however many points lie on it.** A point on a straight line does not split it into two segments with a handle each that both move the same line; the handles and the drag work on the route with such points dropped.
- **"Add point here" puts the point on the drawn route,** not where the pointer was, so a point added a few units beside a straight line no longer gives the stubs a jog at each end.
- **Each stored point of a step or smooth step edge has a dot to drag in any direction,** as a curve's points do, and "Remove point" in its right-click menu; the dot lies over the segment handle at the middle of the run. One point dragged above two facing elements is enough to go round both.
- **"Reset route" in the edge's right-click menu** removes all of the edge's points and its label position, in one undo step, and acts on every selected edge. The routing style, the connection points and the look stay.
- The file format does not change: the stubs and corners are drawn, and the points stored are the ones a drag leaves. `buildEdgePath` is shared, so the SVG export draws the same route.

## Alternatives considered
- **A modifier key to show handles:** the handles already show on hover and when the edge is selected, and Alt is taken by sliding a label and drag-to-duplicate.
- **Wrapping a backwards connection round its elements by itself:** automatic routing, a larger design than this.
- **A stub length setting:** one fixed value keeps drawings alike; revisit if it is too long or short in practice.

## Consequences
- An existing diagram whose route ran back into its own element is drawn differently now, with a stub and a turn. Nothing in the file changes.
- A segment dragged past the far side of the target can still run through the target; the person drags it again.
- Two ends facing each other with a point exactly between them stay a straight line through whatever is in the way.
