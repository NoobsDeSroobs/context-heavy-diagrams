# 0075: Warn when a diagram has edges but no legend entries

## Status
Done (2026-08-24), on `epic/0075-legend-empty-diagnostic`, pending live test/PR/merge. Raised as a side thought during epic 0060 (threat matrix) design work, but entirely unrelated to it — split onto its own branch off `master` rather than folded into that prototype's branch, since epic 0060's own fate is still completely undecided and this fix shouldn't be stuck waiting on it.

## Goal
At minimum, a diagram with any edges should explain what its arrows mean — an empty Legend on a diagram that has connections is easy to forget. Surface it as a standing advisory in the existing Diagnostics panel/View-menu count, rather than a new UI surface.

## Tasks
- [x] A reactive advisory ("Legend is empty — consider adding at least a definition for the arrows/edges used in this diagram.") shown whenever `legend.length === 0 && edges.length > 0`
- [x] Combined with the existing required-tags backfill notices at Canvas.tsx's display layer (`displayedDiagnostics`), not inside `diagnostics` state itself — that state keeps its narrower, sync-point-driven meaning; DiagnosticsPanel's own `entries` prop was already documented as generic text anticipating exactly this kind of addition
- [x] DiagnosticsPanel's empty-state message generalized ("No notices." — was hardcoded to only mention required-tags sync)

## Notes
First design considered was a small warning badge directly on the "Show legend" `ControlButton` (bottom-left canvas controls) — reverted in favor of the Diagnostics panel per the user's direct call ("I think it should be in the diagnostics panel, yes"), which also happened to be the mechanism the panel's own existing comment had already anticipated.
