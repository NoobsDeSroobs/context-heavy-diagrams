# Progress

Short pointer only — the full backlog lives in [docs/planning/](docs/planning/), decisions in [docs/decisions/](docs/decisions/).

## Current status (2026-08-19)

The "complete PoC" batch (0015, 0007, 0008, 0009) is done and merged to `master` — a PoC in the literal sense (validated the hardest interaction ideas, settled the `.chd` shape), not a milestone toward MVP. The tool is still missing core brief requirements (containers, styling, undo/redo, dark/light mode).

**Next batch, agreed order**: ~~[0018](docs/planning/epics/0018-selection-and-keyboard-shortcuts.md)~~ (done, merged) → ~~[0013](docs/planning/epics/0013-configurable-connection-points.md)~~ (done, see below) → [0006](docs/planning/epics/0006-undo-redo.md) → [0004](docs/planning/epics/0004-containers.md) → [0003](docs/planning/epics/0003-styling-panel.md). Containers/styling deliberately last — well-understood, standard features vs. the others needing more real design work.

## Next up

**Epic 0013 (configurable connection points) implemented (2026-08-19)** — nodes can now get extra connection points beyond the default 4 (right-click a shape → "Add connection point here", nearest-side + offset computed from the click). Percentage-based offset, survives resize for free. Removing a custom point is blocked (not "disconnect and dangle") whenever an edge is attached — React Flow's `Edge` type has no way to represent a half-connected edge, so that's the only real option. `npm run typecheck`/`lint` clean, app launches. **Not independently verified**: dragging an edge to/from a custom point, right-clicking precisely on a small Handle to remove it, and whether a point survives resize as expected in practice — all visual/interactive, yours to check per your steer after epic 0018.

Otherwise still outstanding: 0005 (dark/light), 0010/0016 (export), 0014 (drag-edge-to-create-shape), 0017 (speculative), 0019 (blocked on licensing outreach), 0020 (autosave/crash recovery), 0021 (detail frontmatter), 0022 (example gallery — better after 0003/0004 land), 0023 (metadata bucket), 0024 (tabs/windows), 0025 (copy/paste), 0026 (tagging + overlay visualization — design mostly settled, see its Notes).
