# Exports

A diagram can leave the app as SVG, PNG or a draw.io file. The SVG and draw.io exports are pure functions of the diagram (`src/shared/export/`): the same laid-out nodes, oriented edges and resolved appearance go in, the same bytes come out, with no DOM, filesystem or clock. The app (File → Export) and `chd export` both call them. The SVG layout is also what the layout check judges ([ADR 0124](../decisions/0124-svg-export-from-a-shared-pure-renderer.md)).

## draw.io (`renderDiagramDrawio`)

`.drawio` is mxGraph XML. The app opens the file, so the output can be checked against the real thing. It is a picture of the diagram, not a bridge: edits made in draw.io do not come back, and there is no import.

- **Plain, uncompressed XML, one cell per line,** with one page and no page boundary (`page="0"`), so it diffs in git and every reader of the format opens it. The colour scheme is light, as for the SVG; `--theme dark` and the app's dark theme set the page background.
- **No dialog in the app:** a draw.io file has no padding, background or legend to choose. `chd export` takes the format from `--format`, else from an output ending in `.drawio`, and refuses the SVG-only options for it.
- **Connection points stay on the edge,** where draw.io keeps them: its style carries `exitX`, `exitY`, `entryX` and `entryY`, the exact attachment as a fraction of the node's box. An edge that left a custom point leaves the same spot; the node keeps its four default points in draw.io, which has no per-shape list of them.
- **Containers hold their children:** a container is a vertex with `container=1`, a child has it as its parent and a position relative to it. A parent that is missing, or in a cycle, is drawn at its absolute position.
- **Tags travel as data:** an element with tags is an `<object>` whose attributes are the tags (shown in Edit Data), the key made a valid attribute name. Lock state is not carried.
- **Icons are image cells inside the node,** at the slot they have. Built-in icons are written as standalone SVG in the draw.io data-URL form (`data:image/svg+xml,<base64>`: a `;base64` would end the style value); custom icons are passed on from their data URL; one that cannot be read is left out, as in the SVG.
- **Text is left to draw.io.** Labels are HTML cells that wrap on their own, so wrapping can differ a little from the canvas.
- **What is lost or approximated is said.** The function returns `notes`, one line per kind: curved and stepped routes drawn with draw.io's own routing, extra connection points, pulse animation, tag locks, notes, links to other diagrams, reference images, the legend, the threat matrix, highlight chips, and connections or lines that could not be drawn. `chd export` prints them on stderr as `chd: note: ...` and exits 0; the app shows them after the file is written. Nothing is dropped silently.

| This app | draw.io |
|---|---|
| Entity, container, text node | A rounded vertex; `container=1`; `text` style, with `rotation` |
| Free-form line | An edge with no ends, through its points |
| Edge | An edge between two cells, with waypoints and `labelBackgroundColor` for the chip |
| Routing: bezier, Catmull-Rom | `edgeStyle=orthogonalEdgeStyle;curved=1` |
| Routing: straight, step, smooth step | no edge style; `orthogonalEdgeStyle`; with `rounded=1` |
| Label position along the line | The edge label's `x` in -1..1 |
| Arrow and diamond ends, circles, crow's feet | `open`, `block`, `diamond`, `oval`, `ERone` / `ERmany` / `ERoneToMany` / `ERzeroToOne` / `ERzeroToMany` |
| Dashed and dotted, custom dash | `dashed`, `dashPattern` with `fixDash` |
| Flow animation | `flowAnimation=1` |
| Fill, border, opacity, font | `fillColor`, `strokeColor`, `strokeWidth`, `fillOpacity`, `strokeOpacity`, `textOpacity`, `fontSize`, `fontColor`, `fontFamily`, `fontStyle` |
| A single matching highlight, when switched on | The border colour and width, as in the SVG |

A third renderer follows the canvas, so this table is where to look when one changes. A test exports every diagram under `examples/` in both themes and checks the file is balanced, deterministic, free of `NaN`, that every reference resolves, that a container comes before its children, and that no style value would break the style string.
