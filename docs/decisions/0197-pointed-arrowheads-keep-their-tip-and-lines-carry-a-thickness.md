# 0197: Pointed arrowheads keep their tip, and a legend line carries a thickness

## Status

Accepted. Extends [0014](0014-node-and-edge-style-schema.md) (markers) and [0196](0196-new-edges-follow-a-line-of-the-diagrams-legend.md) (the line new edges follow).

## Context

Three things showed up with the line new edges follow:

1. A legend line had no thickness, so a thick edge copied into the legend, or a legend line used for new edges, came out at the built-in thickness.
2. A line was stroked all the way to the end of the path, where a pointed arrowhead has no width. The flat end of the line stuck out past the tip and blunted it, the more so the thicker the line.
3. The lists that pick a line (the edge-style button and its picker) showed only a dash style as a grey bar, so colour, thickness and ends could not be judged.

## Decision

- A legend entry of kind `line` may have `strokeWidth`, in pixels, as an edge's style does. The pick-from-an-edge flow copies it when the edge sets one, a new edge drawn with the line gets it, and the legend panel, the image exports and the assistant tools (`add_legend_entry`, `set_legend_entry`) know it. Absent means the built-in thickness, so older files read as before and an older app ignores the field. The legend sample is drawn at most 3 thick, since the ends scale with the thickness and the sample is one row.
- A shape that comes to a point (`arrowClosed`, `diamondFilled`) has a `trim`, in marker units: how far the line stops short of the tip. The line is stroked that much shorter and the marker's reference point moves back by the same amount, so the tip stays exactly where the line used to end (the node boundary) and is sharp. The trim is in marker units and the marker scales with the stroke width, so the same constant fits every thickness. A shape whose own outline already covers the end of the line (open arrow, circles, crow's foot) has none.
- The shortening is done on the path string (`trimPath`), which reads only the commands this app writes. It is applied wherever a marker is drawn: edges, freeform lines, the legend samples, the direction-set swatch, and the SVG export (which draws arrowheads as shapes and strokes the shortened path). A path it cannot read is drawn as before.
- A line is previewed as the line itself (`EdgeLinePreview`): its colour, thickness (at most 3), dashes and both ends, with the real markers. The edge-style button and the picker use it for the diagram's lines and for the presets.

## Alternatives considered

- **Round or extend the arrowhead to cover the line's end.** A pointed head is the shape people expect; widening it changes every diagram.
- **Dash the stroke short with `stroke-dasharray`.** It conflicts with dashed lines and flowing animation, which already own the dash pattern.
- **Trim only in the canvas.** The exported SVG would show the blunt tip the canvas no longer has.
- **Keep the legend without a thickness.** A legend line could then never stand for a thick edge, and a diagram that uses thickness to mean something could not say so.

## Consequences

- `docs/file-format.md` documents `strokeWidth` on a legend line. The compare view does not list a change of a legend line's thickness separately.
- A personal default picked from the presets still replaces the whole default, as in 0045; the presets carry no thickness.
