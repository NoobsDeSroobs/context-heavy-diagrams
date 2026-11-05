# 0167: An assistant can see the diagram it drew

## Status
Not Started.

## Goal
After an assistant draws or changes a diagram it can look at the result, find overlaps and crowded labels, and fix them, without opening the app.

## Why
In both trial runs the assistant never saw its output. One had no renderer; the other wrote its own and could not open it, because the browser tool refused a local file. Both reported layout as unchecked. `chd export` already writes an SVG without the app, but an assistant cannot read an SVG as a picture, and a rasteriser is not something the command line or the server has today.

## Options
- **An MCP tool that returns a PNG as an image,** so a client that can see images sees the diagram with no shell and no browser. Needs a rasteriser that runs without a system runtime or a window: a WebAssembly one is the likeliest, and it is a new dependency (size, licence, notice) to evaluate.
- **`chd export --png`** with the same rasteriser, for an agent with a shell and a way to view files.
- **A text report,** needing no image: elements that overlap, edges that run through a box they do not connect, labels that collide, connected elements closer than the minimum of [0162](0162-minimum-distance-between-connected-elements.md). Works for any client and can come first.
- The Electron-as-Node launcher cannot open a window, so rendering through the app's own engine is not an option without a separate mode.

## Tasks
- [ ] Spike the rasteriser options: size, licence, behaviour on Windows and Linux, fonts
- [ ] The geometry report as a shared module, exposed as `chd check` rules or a separate `chd lint`, and as an MCP tool
- [ ] The PNG: MCP tool and `chd export --png`
- [ ] Guidance: render and look after the geometry pass, and fix what the report lists
- [ ] Parity with [0166](0166-mcp-and-cli-parity.md); update `docs/architecture/ai-integration.md`

## Notes
Raised after the first trial runs.

Raised in a trial run, 2026-11-06: `chd export` draws the light theme with the theme's own background by default (`--theme light`, `--background theme`), so an assistant's SVG came out on white although nobody asked for light mode. Not urgent. Test it with the PNG work: whether the default should follow the app's theme, be transparent, or stay light and be said so in the help and the skill.
