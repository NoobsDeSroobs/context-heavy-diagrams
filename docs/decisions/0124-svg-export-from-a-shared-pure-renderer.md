# 0124: SVG export from a shared, pure renderer, and `chd export`

## Status
Decided (2026-10-21). The renderer, the app's **File → Export as SVG…** and `chd export` for SVG are built. A PNG from the command line is not (see "Not decided yet").

## Context
PNG was the only way out of the app ([ADR 0051](0051-png-export.md)), the weakest point against almost every other diagramming tool and the main way a diagram reaches a wiki or a README. Two things were wanted: an SVG that is real vector (ADR 0051 decision 1 ruled out a wrapped screenshot), and a command that produces the image from a `.chd` file without opening the app, so CI can regenerate it whenever the diagram changes.

The command line is plain Node run by the app's own executable in `ELECTRON_RUN_AS_NODE` mode ([ADR 0106](0106-chd-command-line-tool.md)), which has no Chromium and no display. That rules out anything that needs a page to lay out.

## Decision
**A pure function turns a diagram into SVG, and both the app and the command call it.** `renderDiagramSvg` (`src/shared/svg/renderDiagram.ts`) takes a parsed `DiagramFile` and options and returns the document text. It draws native elements (`<rect>`, `<path>`, `<text>`, `<marker>`), so the result opens and edits in Inkscape or Illustrator. It touches no DOM, no filesystem and no clock, so the same inputs give the same bytes and a regenerated image only changes when the diagram does.

**What is shared with the canvas is data and rules, extracted rather than copied.** The mirrored logic is rules about geometry, colour and style, not rendering code, so it lives in plain modules that both sides import, not in a renderer base class (the canvas components are React function components on hooks, the export is a function returning a string; they have no runtime in common to inherit from):

- `src/shared/geometry/`: `edgePath.ts` (the one place an edge's routing becomes a path string, called by `LabeledEdge` and the export), `bendablePath.ts`, `orthogonalPath.ts`, `connectionPoints.ts` (which points a node has and where they sit), `pathSampling.ts`.
- `src/shared/styleDefaults.ts` (the built-in look as data, [ADR 0117](0117-built-in-style-defaults-are-data.md)), `highlights.ts`, `zIndexOrdering.ts`, `theme.ts`.
- `src/shared/svg/`: `color.ts` (a CSS colour parser and the theme flip of [ADR 0034](0034-theme-adaptive-color-value-flip.md); the canvas keeps the browser's parser and calls the shared flip), `markerShapes.ts` (the edge-end markers as data, drawn by both `edgeMarkers.tsx` and the export), `appearance.ts` (a node or edge's stored style, the defaults, the theme and a single matching highlight resolved into concrete values), `textLayout.ts`, `model.ts` (absolute positions, stacking, direction sets, edge endpoints), `legendItems.ts` and `legendPlacement.ts` (moved out of the renderer, unchanged in behaviour).

**What is mirrored, not shared**, and so must be kept in step by hand when the canvas changes: the node box layout (padding, corner radius, icon slot offsets, container and text-node label placement, the text-node clip) which the canvas gets from `main.css`; the edge-label chip; the highlight chips; the legend box; and the direction-set orientation of an edge (`model.ts` mirrors `edgeDirectionSets.ts`). Each is a handful of constants next to the code that draws it.

**Text is estimated, not measured.** An SVG `<text>` does not wrap, and there is no layout engine in Node. `textLayout.ts` estimates widths from per-character advances of a typical sans-serif (a little wide, so a label wraps early rather than overflowing) and wraps at spaces, breaking a word that is wider than the line. The font is whatever the element names, else the app's page font stack; the machine that opens the SVG supplies the real font, so text can differ slightly in width from the canvas. This is the main fidelity limit.

**Arrowheads are plain shapes, not `<marker>` elements.** The canvas uses SVG 2's `context-stroke`, which most SVG editors and renderers do not understand, and Affinity Designer ignores markers altogether (found when the first version drew lines without arrowheads there). The export draws each end marker from the shared shape data as a group of ordinary paths with literal colours, scaled by the stroke width and turned to the line's direction at that end, the way a marker with `markerUnits="strokeWidth"` is. Each edge is one group holding its line and arrowheads.

**The result is a picture, not a connected diagram.** SVG has no connectors, so in an editor a line is a path that does not follow a shape when the shape moves. The connection lives in the `.chd` file.

**Icons are resolved by the caller.** The renderer takes a map of icon assets and never reads a file. Built-in icons are trusted bundled markup, drawn inline as vector; a custom icon is a data URL drawn as an `<image>` and never inlined, since a user-supplied SVG may contain script (the canvas makes the same split). In the app the assets come from the existing icon readers. In the command, a custom icon path must stay inside the diagram's folder and be a PNG or SVG ([ADR 0115](0115-paths-stored-in-diagrams-are-untrusted.md)); the app's own read-only display still follows outside paths, but an exported file gets shared, so it must not carry another file's bytes away.

**Left out on purpose:** the lock badge, selection and search outlines, resize handles and the layer-panel indicator (editor state, not diagram content). Highlights are session state ([ADR 0025](0025-tagging-and-overlay-visualization.md)), so they are off unless the app has them switched on or the command is given `--highlight`.

**In the app**, **File → Export as SVG…** opens the same dialog as the PNG export (padding, background, legend corner), whose remembered values are shared by both formats (the preference fields keep their `pngExport` names to avoid migrating settings files). The SVG is rendered from the diagram's data, not from the DOM, so unlike the PNG export it needs no deselecting and no mounting of off-screen elements. The main process shows the save dialog and writes the text.

**On the command line**, `chd export <file.chd>` writes an `.svg` next to the diagram (`-o` to choose, `-` for stdout) with `--theme`, `--padding`, `--background`, `--no-legend`, `--legend-corner` and `--highlight`. It only reads the diagram, so the stale-edit rule ([ADR 0109](0109-stale-edit-check-for-every-ai-write-path.md)) does not apply, and it refuses an output that is not an `.svg`, so it cannot overwrite a diagram. The command is bundled by `scripts/build-cli.mjs` into `resources/cli/export.mjs` (git-ignored, built by `npm run build`) and loaded only for this command, so the other commands stay plain Node with nothing to build.

## Alternatives considered
- **`html-to-image`'s `toSvg()`, a DOM snapshot in a `<foreignObject>`.** Matches the screen exactly and is cheap, but it is not editable vector (ADR 0051 decision 1) and only runs inside the app.
- **The command starts the app headless and captures the canvas.** Identical to the on-screen image, but it needs a display (a virtual one on Linux CI), starts slowly and adds a hidden-window mode to the main process.
- **A shared renderer base class.** Considered because so much must be mirrored. The mirrored part is rules, not rendering, so extracting those rules gives the reuse without an inheritance tree across React components and a string builder.
- **Measuring text with a font library in Node.** Exact for one font, but the font on the reader's machine decides the real width anyway, and it adds a dependency and font files. The estimate is deterministic and costs nothing to ship.

## Consequences
- A second renderer exists and must follow changes to the canvas; the mirrored list above is where to look. A test renders every diagram under `examples/` in both themes and checks the output is well formed, deterministic, free of `NaN` and that every reference it makes is defined; another compares the shared bezier with React Flow's own, so a library change is noticed.
- Two small behaviour changes in the canvas came with the extraction: the segment nearest a right-click on a line is found by evaluating the curve instead of sampling a throwaway DOM path, and edge routing for every style now goes through `buildEdgePath`.
- The `tsconfig` files allow `.ts` import extensions, which the shared modules need so Node can run them directly in tests and esbuild can bundle them for the command.
- No new dependency.
- The SVG's text can differ slightly from the canvas in width; an icon is drawn only if it could be read; a node with no stored size is sized from an estimate of its label.
- **Not verified:** the app's menu item and save dialog in a live run, the command in a packaged build (the built-in icons are read from the bundled Tabler package in `app.asar`), and everything on Linux and macOS.

## Not decided yet
A PNG from the command line needs a rasteriser, since the command has no Chromium. The plan is to rasterise this SVG with a small WASM build (offline, no native binaries, the same on Windows and Linux), which also needs font files for text; the in-app PNG stays on `html-to-image`, so the two PNGs can differ slightly. PDF export follows from the SVG.
