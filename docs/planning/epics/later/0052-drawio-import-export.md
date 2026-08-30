# 0052: Draw.io (diagrams.net) import/export

## Status
Not Started — not yet scoped. Raised by the user as an idea for later, then explicitly archived in the same conversation ("let's archive this idea for later") rather than pursued now.

## Goal
Interop with draw.io / diagrams.net — read and/or write its `.drawio` file format, in service of this app's existing low-lock-in stance (see `docs/file-format.md`'s own design intent).

## Format background
`.drawio` is mxGraph XML. Not a formally standardized spec (no ISO/W3C body behind it), but the draw.io/diagrams.net app itself is open source (Apache 2.0), so there's a real reference implementation to check behavior against and no licensing risk in depending on the format.

## The real fork (not resolved here)
Which direction is actually harder was debated in the raising conversation and landed on the *opposite* of the initial guess:

- **Export (this app → `.drawio`)**: initially assumed to be the easier direction (we control the output, mxCell geometry/style strings are a known target). But this app supports **configurable connection points per shape side** ([epic 0013](../completed/0013-configurable-connection-points.md)/[0039](../completed/0039-connection-point-counts.md)), and draw.io has no equivalent concept — its connection points are fixed per shape (or freeform along the perimeter). Exporting would have to either drop that configurability or approximate it, which is real lossy-fidelity work, not a mechanical mapping.
- **Import (`.drawio` → this app)**: draw.io's open-ended style-string mini-language and large stencil/shape library make a *fully general* importer hard, but a scoped importer (basic shapes, containers, edges, labels; skip or flatten anything exotic) may be more tractable than getting connection-point fidelity right on export.

Which direction to build first — or whether both are worth it — needs a real design pass, not a guess. Whichever is chosen, a lossy case needs an explicit fidelity contract (what gets dropped or approximated, and how the user is told) rather than silent data loss, consistent with [ADR 0029](../../../decisions/0029-backward-compatible-loading-is-a-standing-rule.md)'s spirit even though that ADR is about this app's own format, not a foreign one.

## Notes
Not scheduled into the current batch (see [PROGRESS.md](../../../../PROGRESS.md)) — flagged here so it isn't lost, not because it's next up.
