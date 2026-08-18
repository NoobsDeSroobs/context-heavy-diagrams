# Progress

Short pointer only — the full backlog lives in [docs/planning/](docs/planning/), decisions in [docs/decisions/](docs/decisions/).

## Current status (2026-08-18)

Epic [0012](docs/planning/epics/0012-editable-anchored-labels.md) (editable shape/text/edge labels) is done, committed on branch `epic/0012-editable-anchored-labels`, not yet merged. Along the way it surfaced a big design discussion: [ADR 0005](docs/decisions/0005-diagram-identity-and-linking.md) moves diagram identity/linking away from folder-and-filename conventions (not rename-safe in either direction) to content-based identity + explicit downward-only links — **supersedes the brief's original always-a-folder file format**. Not yet implemented; that's epic [0015](docs/planning/epics/0015-single-file-diagram-format.md), user-flagged as high priority for the next batch.

Four new epics logged from that discussion: [0015](docs/planning/epics/0015-single-file-diagram-format.md) (single-file format migration, high priority), [0016](docs/planning/epics/0016-zip-export-for-sharing.md) (zip export), [0017](docs/planning/epics/0017-url-based-linking.md) (speculative, distant). Epic [0009](docs/planning/epics/0009-linked-diagram-navigation.md) updated to match the new model.

## Next up

Merge epic 0012, then order the next batch of 3-5 epics together (epic 0015 confirmed high priority for that batch).
