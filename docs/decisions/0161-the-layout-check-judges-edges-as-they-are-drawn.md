# 0161: The layout check judges edges as they are drawn

## Status
Accepted (2026-11-09). Extends the layout check of [ADR 0148](0148-an-assistant-builds-a-diagram-by-operations-that-answer.md); the layout it judges is the SVG export's ([ADR 0124](0124-svg-export-from-a-shared-pure-renderer.md)).

## Context
An assistant that writes a diagram cannot look at it: a picture needs a rasteriser or an installed browser, which the command line and the MCP server do not have, and not every client shows an image to its model. What it can read is a list of what is wrong. That list covered overlapping elements, labels that do not fit their box or the gap between two elements, and an edge running over an element, but the last was a straight line between the two connection points: an edge with bend points was skipped, a curve was judged as a line, and edges crossing each other and labels sitting on things were not looked for.

## Decision
1. **Edges are judged on the path that is drawn.** The check takes each edge's endpoints from the export's layout and its route from `buildEdgePath`, the function the canvas and the export both draw with, so curves, bend points and the routing style are included. A diagram with edge direction sets is judged in the direction set it shows.
2. **What it reports,** in addition to the earlier list: an edge drawn across an element it does not join (an element inside either end is not counted, nor is a container); two edges that cross; and an edge label whose box covers an element, lies on another edge's line, or overlaps another label. The label box is the one the export draws, at the edge's label position.
3. **Quiet by construction where the drawing is meant to touch.** Edges that share a connection point meet at it and fan out, so a crossing within the straight lead-in of both ends is not reported. A label already reported as not fitting the gap between its two elements is not reported again.
4. **It stays a list, in the answers `chd edit`, `chd ask inspect` and the MCP tools already give,** grouped by kind so a dense diagram gives one line with a count and a few examples. Element names are quoted on one line and cut short.
5. **No picture is produced by this tool.** An SVG-to-PNG converter is a separate tool; `chd export` already gives it an SVG.

## Alternatives considered
- **A PNG from an MCP tool and `chd export --png`.** Needs a bundled WebAssembly rasteriser and a font (several MB, and it would not look like the app), or an installed browser (absent on some systems, and not our code under the offline rule). The list works in every client.
- **Keep the straight-line approximation and add the missing cases beside it.** Two models of where an edge is would drift apart; the drawn path is already computed once for everything else.
- **Report every crossing as an error.** Crossings are sometimes the clearest drawing. The guidance says to fix them where reasonable and to say so when one is kept.

## Consequences
- The list is longer than before on diagrams that were quiet: the larger example diagrams now show crossings and labels on lines that were always there.
- The check uses the default straight lead-in length, not the person's preference, and judges an unrotated element's box: a rotated text element is judged as if upright.
- The geometry is an estimate of what is drawn (curves flattened into short straight pieces, text width estimated as in [ADR 0124](0124-svg-export-from-a-shared-pure-renderer.md)), so a result a pixel or two either way is not a defect in the diagram.
