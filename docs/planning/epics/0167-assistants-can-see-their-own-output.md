# 0167: An assistant can see the diagram it drew

## Status
In Progress: the spike is done (2026-11-08), the findings are below and the choice is the maintainer's.

## Goal
After an assistant draws or changes a diagram it can look at the result, find overlaps and crowded labels, and fix them, without opening the app.

## Why
In both trial runs the assistant never saw its output. One had no renderer; the other wrote its own and could not open it, because the browser tool refused a local file. Both reported layout as unchecked. `chd export` already writes an SVG without the app, but an assistant cannot read an SVG as a picture, and a rasteriser is not something the command line or the server has today.

## Options
- **An MCP tool that returns a PNG as an image,** so a client that can see images sees the diagram with no shell and no browser. Needs a rasteriser that runs without a system runtime or a window: a WebAssembly one is the likeliest, and it is a new dependency (size, licence, notice) to evaluate.
- **`chd export --png`** with the same rasteriser, for an agent with a shell and a way to view files.
- **A text report,** needing no image: elements that overlap, edges that run through a box they do not connect, labels that collide, connected elements closer than the minimum of [0162](../completed-epics.md#0162-minimum-distance-between-connected-elements). Works for any client and can come first.
- The Electron-as-Node launcher cannot open a window, so rendering through the app's own engine is not an option without a separate mode.

## Tasks
- [x] Spike the rasteriser options: size, licence, behaviour on Windows and Linux, fonts (see Spike findings; Linux and macOS not tried)
- [ ] The geometry report on the real edge paths: edge against element for bent and curved edges, edge crossing edge, label chips against elements and edges. It builds on `layoutIssues`, which `chd edit` and `chd ask inspect` already answer
- [ ] The PNG: MCP tool and `chd export --png`
- [ ] Guidance: render and look after the geometry pass, and fix what the report lists
- [ ] Parity with [0166](../completed-epics.md#0166-the-mcp-server-and-the-command-line-share-their-checks); update `docs/architecture/ai-integration.md`

## Notes
Raised after the first trial runs.

Raised in a trial run, 2026-11-06: `chd export` draws the light theme with the theme's own background by default (`--theme light`, `--background theme`), so an assistant's SVG came out on white although nobody asked for light mode. Not urgent. Test it with the PNG work: whether the default should follow the app's theme, be transparent, or stay light and be said so in the help and the skill.

## Spike findings (2026-11-08)

**The geometry report is partly built already.** `layoutIssues` (`src/shared/edit/inspect.ts`) finds overlapping elements, a label that does not fit its box, an element sticking out of its container, an edge label with no room, and an edge running over an element; `chd edit` and `chd ask inspect` return it. On a deliberately messy diagram it found the overlap, the label overflow and one edge over an element, and it said nothing on the example diagrams. It missed: edges that cross each other, edges with routing points (it skips them), and an edge's real curve (it tests a straight line between the connection points). The curves are already computed by shared pure code (`src/shared/geometry`), so these can be tested on the path that is drawn.

**Seeing the diagram, measured on Windows with the gallery's C4 context diagram (1413 x 749):**

| | Installed browser (Edge, headless) | `@resvg/resvg-wasm` 2.6.2 |
|---|---|---|
| New dependency | none | 2.5 MB wasm (the extension's server file is 1.4 MB today), MPL-2.0, a notice |
| Time | 1.3 to 2.1 s | 0.06 s after a 0.04 s start |
| Fonts | the computer's own, as the app | none built in: without a font file every label vanishes without a message; bundling a font (and a bold one) is needed, and it will not look like the app |
| Fidelity | curves, markers, label chips, bold all right | same once a font is supplied; bold needs its own font file |
| Where it works | Windows always (Edge); macOS and Linux only if Chrome, Edge or Chromium is installed (a snap Chromium may not read a temp file); not tried | everywhere, the same |
| Offline rule | the browser is not our code and may make background requests despite flags | none |

The browser route needs a fresh `--user-data-dir` (else it can join a running browser) and should load the SVG through an `<img>` in a small page, which switches scripts and outside loads off. `--force-device-scale-factor=2` gives a sharper picture. `canvaskit-wasm` is 26 MB and `sharp` and `@resvg/resvg-js` are native packages per platform, neither fitting a single bundled server file.

A PNG would go to the client as an image from the MCP tool; whether Claude Desktop shows it to the model is the client's choice (the extension's `read_file` already returns pictures).

**Not part of the spike, worth a look:** the default light export of that gallery diagram has black text on dark fills, while `--theme dark` is right. It belongs with the export-theme note above.
