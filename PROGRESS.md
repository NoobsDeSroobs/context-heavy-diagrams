# Progress

Short pointer only — the full backlog lives in [docs/planning/](docs/planning/), decisions in [docs/decisions/](docs/decisions/).

## Current status (2026-08-18)

Epic [0007](docs/planning/epics/0007-icon-slots.md) (icon slots) done, committed on branch `epic/0007-icon-slots`, not yet merged. Built-in icons (Tabler, MIT-licensed) via a searchable picker, custom icon upload, remove, right-click context-menu infrastructure (reusable for epics 0008/0013). See [ADR 0006](docs/decisions/0006-icon-storage-model.md) for the storage model and [docs/licensing.md](docs/licensing.md) for why vendor icon packs (AWS/Azure/etc.) are deliberately out of scope.

**"Complete PoC" batch, agreed and ordered** (everything else is usability/feature-expansion work for a later batch):

1. ~~0015 — single-file diagram format~~ **done**
2. ~~0007 — icon slots~~ **done**
3. [0008](docs/planning/epics/0008-detail-sublayer.md) — detail sublayer (Markdown panel)
4. [0009](docs/planning/epics/0009-linked-diagram-navigation.md) — linked-diagram navigation. Deliberately last: highest complexity/integration-risk, done once icons and details already exist and are stable.

Rationale: 0008 and 0009 are the two features the brief itself names as this tool's actual differentiator from generic tools like draw.io. Everything in the "later batch" pile (styling panel, containers, dark/light mode, undo/redo, alignment/snapping, configurable connection points, drag-to-create-shape, zip export, selection/keyboard shortcuts, icon-picker GUI polish) makes an already-working tool nicer, but doesn't prove the core concept.

## Next up

Merge epic 0007, then start epic 0008 (detail sublayer).
