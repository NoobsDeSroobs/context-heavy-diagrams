# Progress

Short pointer only — the full backlog lives in [docs/planning/](docs/planning/), decisions in [docs/decisions/](docs/decisions/).

## Current status (2026-08-19)

The "complete PoC" batch (0015 single-file format, 0007 icon slots, 0008 detail sublayer, 0009 linked-diagram navigation) is done and merged to `master`. Note: this was a PoC in the literal sense — validating that the hardest interaction ideas (linking, drill-down, detail sublayers) actually work and feel right, and settling the `.chd` file shape — not a milestone toward MVP. The tool is still missing core brief requirements (containers, styling, undo/redo, dark/light mode); it's not close to usable for real work yet.

Scoped and ready whenever, not yet started: epic 0022 (example diagram gallery — better attempted after the batch below lands, most entries need containers/styling), epic 0023 (custom metadata bucket, fully independent).

## Next up

**Next batch, agreed order**: ~~[0018](docs/planning/epics/0018-selection-and-keyboard-shortcuts.md)~~ (done, see below) → [0013](docs/planning/epics/0013-configurable-connection-points.md) (configurable connection points) → [0006](docs/planning/epics/0006-undo-redo.md) (undo/redo, full-state-snapshot approach) → [0004](docs/planning/epics/0004-containers.md) (containers) → [0003](docs/planning/epics/0003-styling-panel.md) (styling panel + ADR 0010's named presets). Containers/styling deliberately last — well-understood, standard features vs. the others needing more real design work.

**Epic 0018 (selection and keyboard shortcuts) implemented (2026-08-19)** — Ctrl+A, Escape (closes whatever's open, else deselects — checked in priority order), Ctrl+D duplicate, Ctrl+O/Shift+S/N (New is in-memory-only, toolbar button added too), Alt+Left breadcrumb-back, Ctrl+0 re-fit. Custom arrow-key nudge was built then removed — React Flow already moves selected nodes on arrow keys natively (5px/20px with Shift) and my handler was stacking on top of it, doubling the movement; caught via live testing, not assumed. Verified interactively via a browser tab against the dev server for everything not requiring the Electron IPC bridge (Ctrl+A, Escape×4 cases, Ctrl+D, native arrow movement). **Two items still need your confirmation**: Shift+click multi-select and Shift+drag box-select — both should already work (pure React Flow config from epic 0009, no custom code), but the test environment's coordinate-click path wasn't reliable enough to verify honestly rather than assume. See epic 0018's Notes for the full detail on what was and wasn't independently verified and why.

Two new stub epics fell out of scoping this batch: [0024](docs/planning/epics/0024-multi-diagram-tabs-or-windows.md) (tabs/windows — referenced by 0006's undo-stack-scope note and 0009's notes) and [0025](docs/planning/epics/0025-copy-paste.md) (copy/paste — split out of 0018, real clipboard semantics rather than a keybinding).

Also outstanding, not in this batch: 0005 (dark/light), 0010/0016 (export), 0014 (drag-edge-to-create-shape), 0017 (speculative), 0019 (blocked on licensing outreach — not engineering), 0020 (autosave/crash recovery), 0021 (detail frontmatter), 0026 (tagging + overlay visualization — design mostly settled: standard-field tags, a separate toggleable highlights panel mapping tag→color; a handful of rendering-mechanics questions deliberately deferred, see its Notes).
