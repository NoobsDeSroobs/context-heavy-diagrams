# Progress

Short pointer only — the full backlog lives in [docs/planning/](docs/planning/), decisions in [docs/decisions/](docs/decisions/).

## Current status (2026-08-18)

Epic [0015](docs/planning/epics/0015-single-file-diagram-format.md) (single-file diagram format, ADR 0005) done, committed on branch `epic/0015-single-file-diagram-format`, not yet merged. Save/open round-trip with the new `.chd` single-file model manually confirmed.

**"Complete PoC" batch, agreed and ordered** (everything else is usability/feature-expansion work for a later batch):

1. ~~0015 — single-file diagram format~~ **done**
2. [0007](docs/planning/epics/0007-icon-slots.md) — icon slots
3. [0008](docs/planning/epics/0008-detail-sublayer.md) — detail sublayer (Markdown panel)
   - (0007 and 0008 in either order between themselves)
4. [0009](docs/planning/epics/0009-linked-diagram-navigation.md) — linked-diagram navigation. Deliberately last: highest complexity/integration-risk of the four, done once icons and details already exist and are stable.

Rationale: 0008 and 0009 are the two features the brief itself names as this tool's actual differentiator from generic tools like draw.io. 0007 is close behind. Everything in the "later batch" pile (styling panel, containers, dark/light mode, undo/redo, alignment/snapping, configurable connection points, drag-to-create-shape, zip export, selection/keyboard shortcuts) makes an already-working tool nicer, but doesn't prove the core concept.

## Next up

Merge epic 0015, then start epic 0007 or 0008 (either order).
