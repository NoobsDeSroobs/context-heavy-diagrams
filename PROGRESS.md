# Progress

Short pointer only — the full backlog lives in [docs/planning/](docs/planning/), decisions in [docs/decisions/](docs/decisions/).

## Current status (2026-08-18)

Epic [0008](docs/planning/epics/0008-detail-sublayer.md) (detail sublayer) done, committed on branch `epic/0008-detail-sublayer`, not yet pushed/merged. Right-click "See details" on any node (first context-menu use on `TextNode`), fixed right-side Markdown panel with edit/preview toggle and basic formatting buttons, draft state flushed on save (Ctrl+S now works, not just the toolbar button), hover tooltip. Manually tested and confirmed working.

**"Complete PoC" batch — all four done**: 0015 (single-file format), 0007 (icon slots), 0008 (detail sublayer). Only [0009](docs/planning/epics/0009-linked-diagram-navigation.md) (linked-diagram navigation) remains — deliberately saved for last since it's the highest-complexity/integration-risk of the four, and now icons/details are stable to build on.

Small addition folded into 0008 on request: Delete key now works (was blocking testing) — pulled forward from epic [0018](docs/planning/epics/0018-selection-and-keyboard-shortcuts.md).

## Next up

Push and merge epic 0008, then epic 0009 — the last of the "complete PoC" batch.
