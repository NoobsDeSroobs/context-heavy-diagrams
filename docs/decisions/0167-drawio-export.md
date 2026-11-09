# 0167: Export to draw.io

## Status
Accepted (2026-11-09). Builds on [ADR 0124](0124-svg-export-from-a-shared-pure-renderer.md), whose shared model and appearance rules it reuses. Import is not decided: an importer is a separate piece of work.

## Context
draw.io (diagrams.net) is the tool most people would move from or share with. Its file format is mxGraph XML, not a formal standard, but the app is open source and opens the file, so the output can be checked against the real thing. The worry was connection points: this app lets a node have more than the four default points per side, and draw.io has no per-shape list of them.

## Decision
1. **A pure function turns a diagram into a `.drawio` file,** `renderDiagramDrawio` (`src/shared/export/drawio.ts`). It takes the same laid-out nodes, oriented edges and resolved appearance as the SVG export, touches no DOM, filesystem or clock, and gives the same bytes for the same input. The app (**File → Export → draw.io…**, no dialog: a draw.io file has no padding, background or legend to choose) and `chd export --format drawio` both call it. The command takes the format from `--format`, else from an output ending in `.drawio`, and refuses the SVG-only options for it.
2. **Plain, uncompressed XML, one cell per line,** with one page and no page boundary (`page="0"`), so it diffs in git and every reader of the format opens it. The default colour scheme is light, as for the SVG; `--theme dark` and the app's dark theme set the page background.
3. **Connection points are kept on the edge, which is where draw.io keeps them.** An edge's style carries `exitX`, `exitY`, `entryX` and `entryY`, the exact attachment as a fraction of the node's box. So an edge that left a custom point still leaves the same spot, and the node keeps its four default points in draw.io. What is lost is only that draw.io does not offer the extra points on the node for a *new* connection.
4. **Containers hold their children.** A container is a vertex with `container=1`; a child has it as its parent and a position relative to it, which is how both formats already store it. A parent whose container is missing, or is part of a cycle, is drawn at its absolute position on the page.
5. **Tags travel as data.** An element with tags is an `<object>` whose attributes are the tags (shown in draw.io's Edit Data), the tag key made a valid attribute name. Lock state is not carried.
6. **Icons are image cells inside the node,** at the slot they have, so they move with it. Built-in icons are written as standalone SVG in the draw.io data-URL form (`data:image/svg+xml,<base64>`: a `;base64` would end the style value); custom icons are passed on from their data URL. An icon that cannot be read is left out, as in the SVG.
7. **Text is left to draw.io.** Labels are HTML cells that wrap on their own; nothing is estimated, so wrapping can differ a little from the canvas. The font stack is written as is so a missing font falls back to a sans-serif.
8. **What is lost or only approximated is said.** The function returns `notes`, one line per kind: curved and stepped routes drawn with draw.io's own routing, extra connection points, pulse animation, tag locks, notes, links to other diagrams, reference images, the legend, the threat matrix, highlight chips, and connections or lines that could not be drawn. `chd export` prints them on stderr as `chd: note: ...` and exits 0; the app shows them after the file is written. Nothing is dropped silently.

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

## Alternatives considered
- **Compressed XML (deflate and base64), draw.io's own default.** Smaller, but unreadable and undiffable; draw.io opens the plain form.
- **Keep the node's connection points as draw.io custom shape connection constraints.** That needs a custom stencil per node, which draw.io then treats as an unknown shape.
- **Embed the whole `.chd` in the file for a round trip.** A second copy of the truth that goes stale when the diagram is edited in draw.io, for an import that does not exist yet.
- **Export a picture inside draw.io (an SVG image cell).** Opens everywhere but is not editable, which is the reason to export to draw.io at all.

## Consequences
- A third renderer follows the canvas; its mapping table above is where to look. A test exports every diagram under `examples/` in both themes and checks the file is balanced, deterministic, free of `NaN`, that every reference resolves, that a container comes before its children, and that no style value would break the style string.
- **Verified (2026-11-09):** exported files were opened in the draw.io web app: nested containers, curved edges with labels and attachment points, icons in their corners, tags in Edit Data, dark theme. The menu item, native save dialog, written file and notes dialog were driven in the running app on Windows.
- **Not verified:** the draw.io desktop app, step and smooth-step routing and crow's-foot ends at zoom, text wrapping differences, Linux and macOS.
- The result is a picture of the diagram, not a bridge: edits made in draw.io do not come back.
