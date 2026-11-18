# 0196: Grab every segment of a right-angled edge, and no spikes

## Status
Not Started. Build after 0195 is merged.

## Goal
A step or smooth step edge can be bent by grabbing any of its straight segments, including the ones that touch the source and the target, so routing an edge round two elements is one drag instead of a hunt for a handle that is not there; a single point never makes a route double back on itself; and a right-click "Reset route" puts an edge back to its default.

## The problem
Raised 2026-11-18. Put A on the left and B on the right, connect B's right side to A's left side (a straight line through both), set the routing to smooth step, and right-click "Add point here" in the middle.

- **The point never shows.** Step and smooth step edges draw drag handles on segment midpoints, not on stored points (only catmull-rom draws a handle per point). A segment touching the source or the target gets no handle at all ([ADR 0077](../../decisions/0077-orthogonal-edge-segment-dragging.md), first-version scope). A point on a straight line makes two segments, both touching an end, so nothing can be grabbed and the edge looks unchanged. It only becomes usable after an element is moved, which creates a bend and so an interior segment.
- **One point cannot go round both elements.** A single point above the line routes up and straight back down the same vertical line (a spike). Going round needs two points, each outside an element, and the person has to add the second by right-clicking again.

## Proposal
- **A handle on every segment**, the end segments included, shown as today (hover, selected, during a drag). No new key: Alt is taken by label sliding and drag-to-duplicate.
- **Dragging an end segment sideways makes a stub** that leaves the element outward (about 20 px), then runs along the line dragged to. Dragging the one segment of a plain straight edge (no points) makes both stubs, so B's right side, out, up, across above both elements, down, into A's left side is a single drag, stored as two points.
- `moveOrthogonalSegment` already has first- and last-segment branches, but they leave the stub running along the element's border instead of outward, so they are rewritten rather than switched on.

- **Honour the sides the edge leaves and enters by (the spike).** A leg that would run back into the element it leaves gets a short outward stub first, and likewise into the target. Then one point above the line gives B's right side, out, up, across, down, into A's left side, not an up-and-back spike, and the stubs of the drag above are the same stubs. Where the old route reversed on itself the drawn route changes for existing diagrams; the file does not, and the SVG export follows because both use `buildEdgePath` ([ADR 0124](../../decisions/0124-svg-export-from-a-shared-pure-renderer.md)). A point exactly on the straight line still collapses to a straight line.
- **"Reset route" in the edge's right-click menu**: removes all the edge's points (those from "Add point here" and from dragging segments) and its label position (`style.labelPosition`, the label's offset along the edge), one undo step. It keeps the routing style, the connection points the ends use ("Attach automatically" already clears those), colour and the rest. For several selected edges it resets all of them, as "Reverse direction" does.

Not included: making the default route of an edge that leaves an element away from its target (B's right side to an element on B's left) wrap round by itself. That is automatic routing, a bigger feature, and out of scope here.

## Questions to settle
- Stub length (fixed 20 px, or a preference), and what happens when the room outside the element is smaller than the stub.
- Segments shorter than the minimum handle length (16 px) still get no handle; with stubs at 20 px an end segment that is only a stub is borderline.
- Dragging a segment back to the line it came from should remove the points again (the on-release simplify pass); check it does with stubs.
- Handles on a very short edge, where the middle handle of the only segment sits on top of the label.
- The assistants' routing tools ([0168](0168-teach-assistants-to-reroute-edges.md)) write absolute points and are unaffected; the file format does not change.
- Interaction with the points that follow elements ([0195](0195-edge-points-follow-the-elements-they-bend-around.md)): a stub's two corners are ordinary points and are carried like any other.

## Tasks
- [ ] Decide stub length and the short-segment rules, record in an ADR (amends 0077)
- [ ] Stubs that honour the exit and entry sides in `orthogonalRouteVertices` (fixes the spike), with tests for one point above and below, on the line, and on all side pairs
- [ ] Handles for end segments in `orthogonalSegments`, with tests
- [ ] Outward stubs when an end segment, or the only segment, is dragged, with tests (both ends, all four sides)
- [ ] Release simplification with stubs, with tests
- [ ] "Reset route" in the edge context menu (single and multi-selection), with a test and the example below showing it
- [ ] Example diagram: a backwards connection routed round two elements ([ADR 0151](../../decisions/0151-every-visible-feature-has-an-example-diagram.md))
- [ ] Update the Edge routing wording in the shortcuts dialog and the docs if they describe segment handles
