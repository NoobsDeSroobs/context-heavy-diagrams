# Progress

Short pointer only — the full backlog lives in [docs/planning/](docs/planning/), decisions in [docs/decisions/](docs/decisions/).

## Current status (2026-08-19)

Epic [0008](docs/planning/epics/0008-detail-sublayer.md) (detail sublayer) done and merged to `master` (PR #6, commit `d2ddc02`). Right-click "See details" on any node (first context-menu use on `TextNode`), fixed right-side Markdown panel with edit/preview toggle and basic formatting buttons, draft state flushed on save (Ctrl+S now works, not just the toolbar button), hover tooltip. Manually tested and confirmed working.

**"Complete PoC" batch — three of four done**: 0015 (single-file format), 0007 (icon slots), 0008 (detail sublayer), all merged to `master`. Only [0009](docs/planning/epics/0009-linked-diagram-navigation.md) (linked-diagram navigation) remains — deliberately saved for last since it's the highest-complexity/integration-risk of the four, and now icons/details are stable to build on.

Small addition folded into 0008 on request: Delete key now works (was blocking testing) — pulled forward from epic [0018](docs/planning/epics/0018-selection-and-keyboard-shortcuts.md).

**New PC setup + dependency upgrade (2026-08-19)**: set up a new dev machine (README expanded with prerequisites/getting-started detail); in the process, `npm audit` surfaced a high-severity `extract-zip` finding with no available patch, only fixable by a major Electron bump. Upgraded Electron `39.2.6` → `43.4.0` deliberately (not via `npm audit fix --force`, which was tried first and broke `npm run dev` — see [docs/decisions/0007-electron-39-to-43-upgrade.md](docs/decisions/0007-electron-39-to-43-upgrade.md)). Verified typecheck, lint (pre-existing warnings only, unrelated to the upgrade), and `npm run dev` all work post-upgrade. Known follow-up: open/save dialogs no longer remember the last-used folder (Electron 43 behavior change, noted in the ADR) — not yet fixed.

Epic [0009](docs/planning/epics/0009-linked-diagram-navigation.md) (linked-diagram navigation) is implemented on branch `epic/0009-linked-diagram-navigation` (not yet merged here) — see that branch's own `PROGRESS.md` for details; still needs a manual interactive test pass before merging.

**Epic 0022 (example diagram gallery) scoped, not started (2026-08-19)** — a self-documentation technical+functional view of this tool plus a broad gallery of generic example diagrams across standard IT/EA diagram types, run continuously alongside development epics rather than as one bounded deliverable. Includes [ADR 0008](docs/decisions/0008-tool-scope-includes-ea-adjacent-diagrams.md), a scope decision that enterprise-architecture-adjacent diagrams (business capability maps, motivation views, etc.) are explicitly in scope, not just software-architecture diagrams.

**Custom metadata bucket scoped, not started (2026-08-19)** — [ADR 0009](docs/decisions/0009-custom-metadata-bucket.md) + [epic 0023](docs/planning/epics/0023-custom-metadata-bucket.md). A free-form JSON `metadata` field on nodes/edges/diagrams, separate from the tool's own standard fields, editable via a raw JSON textarea in the GUI and guaranteed to round-trip through open/save — closes a real gap found while discussing epic 0022 (today, any field outside the documented schema is silently dropped the instant a file is opened, before any edit).

**Styling panel (epic 0003) expanded with named/searchable style presets (2026-08-19)** — [ADR 0010](docs/decisions/0010-named-searchable-style-presets.md). Edge line/marker styles (and shape fill/border) get a right-click-accessible catalog of industry-standard named presets ("Dependency (UML)", "One-to-many (ERD)"), searchable by keyword like the existing icon picker — an educational aid for novices, not an enforced notation. Presets apply raw style properties only; nothing is stored as a preset "identity" on the element itself. Epic 0013 (connection points) got a note distinguishing it from this — placement vs. visual marker styling are separate concerns that surfaced in the same conversation.

## Next up

Merge epic 0009 once manually tested — the last of the "complete PoC" batch. Separately, optionally: fix the dialog default-path regression from the Electron upgrade (small, see ADR 0007). Epics 0022 (example gallery), 0023 (metadata bucket), and the epic 0003 styling-panel expansion are all scoped and ready whenever there's room for them. Epic 0022 has an open question worth settling — see its Notes — on whether "Ongoing" should become a real epic status.
