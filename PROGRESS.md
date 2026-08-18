# Progress

Short pointer only — the full backlog lives in [docs/planning/](docs/planning/), decisions in [docs/decisions/](docs/decisions/).

## Current status (2026-08-19)

Epic [0008](docs/planning/epics/0008-detail-sublayer.md) (detail sublayer) done and merged to `master` (PR #6, commit `d2ddc02`). Right-click "See details" on any node (first context-menu use on `TextNode`), fixed right-side Markdown panel with edit/preview toggle and basic formatting buttons, draft state flushed on save (Ctrl+S now works, not just the toolbar button), hover tooltip. Manually tested and confirmed working.

**"Complete PoC" batch — three of four done**: 0015 (single-file format), 0007 (icon slots), 0008 (detail sublayer), all merged to `master`. Only [0009](docs/planning/epics/0009-linked-diagram-navigation.md) (linked-diagram navigation) remains — deliberately saved for last since it's the highest-complexity/integration-risk of the four, and now icons/details are stable to build on.

Small addition folded into 0008 on request: Delete key now works (was blocking testing) — pulled forward from epic [0018](docs/planning/epics/0018-selection-and-keyboard-shortcuts.md).

**New PC setup + dependency upgrade (2026-08-19)**: set up a new dev machine (README expanded with prerequisites/getting-started detail); in the process, `npm audit` surfaced a high-severity `extract-zip` finding with no available patch, only fixable by a major Electron bump. Upgraded Electron `39.2.6` → `43.4.0` deliberately (not via `npm audit fix --force`, which was tried first and broke `npm run dev` — see [docs/decisions/0007-electron-39-to-43-upgrade.md](docs/decisions/0007-electron-39-to-43-upgrade.md)). Verified typecheck, lint (pre-existing warnings only, unrelated to the upgrade), and `npm run dev` all work post-upgrade. Known follow-up: open/save dialogs no longer remember the last-used folder (Electron 43 behavior change, noted in the ADR) — not yet fixed.

## Next up

Epic 0009 (linked-diagram navigation) — the last of the "complete PoC" batch. Optionally: fix the dialog default-path regression from the Electron upgrade first (small, see ADR 0007).
