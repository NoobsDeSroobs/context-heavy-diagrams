# 0003: Styling panel

## Status
Not Started

## Goal
A properties panel that appears when a node/edge is selected, driving manual style fields: line type, thickness, colour, fill, etc.

## Tasks
- [ ] Finalize style fields on the node/edge schema (see edge schema open item in [project brief](../../project-brief.md))
- [ ] Properties panel UI, shown on selection
- [ ] Panel edits write through to node/edge `style` data and re-render live
- [ ] Text alignment for shape/text labels (start/center/end — use CSS logical values, not left/right, for RTL correctness). Moved here from epic 0012, which needs this panel to exist before the setting is reachable at all.
