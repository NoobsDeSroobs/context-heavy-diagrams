# 0052: Draw.io (diagrams.net) import/export

## Status
In Progress. **Export is done (0.9.0, tried by the maintainer in draw.io)**; import has not been started and is bigger than first thought, so it waits for its own design pass. The design pass for export is [ADR 0167](../../decisions/0167-drawio-export.md): the connection-point worry below turned out not to be a fork, since draw.io keeps the exact attachment on each edge (`exitX`, `entryX`).

## Goal
Interop with draw.io / diagrams.net — read and/or write its `.drawio` file format, in service of this app's existing low-lock-in stance (see `docs/file-format.md`'s own design intent).

## Format background
`.drawio` is mxGraph XML. Not a formally standardized spec (no ISO/W3C body behind it), but the draw.io/diagrams.net app itself is open source (Apache 2.0), so there's a real reference implementation to check behavior against and no licensing risk in depending on the format.

## The real fork (not resolved here)
Which direction is actually harder was debated in the raising conversation and landed on the *opposite* of the initial guess:

- **Export (this app → `.drawio`)**: initially assumed to be the easier direction (we control the output, mxCell geometry/style strings are a known target). But this app supports **configurable connection points per shape side** ([epic 0013](../completed-epics.md#0013-configurable-connection-points)/[0039](../completed-epics.md#0039-per-side-connection-point-counts)), and draw.io has no equivalent concept — its connection points are fixed per shape (or freeform along the perimeter). Exporting would have to either drop that configurability or approximate it, which is real lossy-fidelity work, not a mechanical mapping.
- **Import (`.drawio` → this app)**: draw.io's open-ended style-string mini-language and large stencil/shape library make a *fully general* importer hard, but a scoped importer (basic shapes, containers, edges, labels; skip or flatten anything exotic) may be more tractable than getting connection-point fidelity right on export.

Which direction to build first — or whether both are worth it — needs a real design pass, not a guess. Whichever is chosen, a lossy case needs an explicit fidelity contract (what gets dropped or approximated, and how the user is told) rather than silent data loss, consistent with [ADR 0029](../../decisions/0029-backward-compatible-loading-is-a-standing-rule.md)'s spirit even though that ADR is about this app's own format, not a foreign one.

## Tasks
- [x] Design pass for export: the fidelity contract (what is dropped or approximated, and how the person is told) and the mapping ([ADR 0167](../../decisions/0167-drawio-export.md))
- [x] `renderDiagramDrawio` in `src/shared/export/drawio.ts`, with tests over every example
- [x] `chd export --format drawio` (or an output ending in `.drawio`), notes on stderr
- [x] File → Export → draw.io…, notes shown after the file is written
- [x] Opened the output in the draw.io web app: nested containers, icons, tags, curved and stepped edges, crow's feet
- [x] Tried in draw.io by the maintainer
- [ ] Import (`.drawio` to this app): a scoped importer (shapes, containers, edges, labels, tags from `<object>`), with the same kind of contract for what it skips. Needs its own design pass

## Notes
Not scheduled into the current batch (see [PROGRESS.md](../../../PROGRESS.md)) — flagged here so it isn't lost, not because it's next up.

Update 2026-10-21: the [comparison with other tools](../../comparison.md) lists the lack of import as the second gap, and draw.io is the tool most people would be moving from. Agreed to look at imports and exports right after the SVG export ([epic 0144](../completed-epics.md#0144-svg-export-and-a-command-line-export)); a candidate to move out of `later/` then.
