# Progress

Short pointer only — the full backlog lives in [docs/planning/](docs/planning/), decisions in [docs/decisions/](docs/decisions/).

## Current status (2026-08-18)

[Epic 0001](docs/planning/epics/0001-bare-electron-react-shell.md) merged to `master`. [Epic 0002](docs/planning/epics/0002-resize-and-rotate.md) (`ShapeNode`/`TextNode` split, resize, rotate, multiple connection points) is done and committed on branch `epic/0002-resize-and-rotate`, not yet merged — round-trip through save/load manually verified. Two new epics spun out of ideas raised during 0002's design discussion, not yet started: [0012](docs/planning/epics/0012-editable-anchored-labels.md) (editable double-click labels on shapes/edges) and [0013](docs/planning/epics/0013-configurable-connection-points.md) (user-addable/removable connection points). [0011](docs/planning/epics/0011-alignment-and-snapping.md) (alignment/snapping) also queued from earlier, none started.

## Next up

Ready for review/merge of `epic/0002-resize-and-rotate` into `master`. After that: pick from epics 0003 (styling panel), 0011, 0012, or 0013 — no fixed order forced yet.
