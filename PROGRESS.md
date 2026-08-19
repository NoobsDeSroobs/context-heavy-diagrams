# Progress

Short pointer only — the full backlog lives in [docs/planning/](docs/planning/), decisions in [docs/decisions/](docs/decisions/).

## Current status (2026-08-19)

The "complete PoC" batch (0015, 0007, 0008, 0009) is done and merged to `master` — a PoC in the literal sense (validated the hardest interaction ideas, settled the `.chd` shape), not a milestone toward MVP. The tool is still missing core brief requirements (containers, styling, undo/redo, dark/light mode) — well, undo/redo as of today, see below.

**Next batch, agreed order**: ~~[0018](docs/planning/epics/0018-selection-and-keyboard-shortcuts.md)~~ → ~~[0013](docs/planning/epics/0013-configurable-connection-points.md)~~ → ~~[0006](docs/planning/epics/0006-undo-redo.md)~~ (all three done and merged) → [0004](docs/planning/epics/0004-containers.md) (containers) → [0003](docs/planning/epics/0003-styling-panel.md) (styling panel + ADR 0010's named presets). Containers/styling deliberately last — well-understood, standard features vs. the others needing more real design work.

## Next up

**Epic 0006 (undo/redo) implemented and reconciled with epic 0013 (2026-08-19)** — full state-snapshot stack over `{nodes, edges}`, Ctrl+Z/Ctrl+Shift+Z plus toolbar Undo/Redo buttons, explicit `pushSnapshot()` calls at each mutation site (see epic 0006's Notes for why a `useEffect`-based first attempt broke under React StrictMode's dev-mode double-invoke and was replaced). Epic 0006 was originally branched before epic 0013 merged, so it missed epic 0013's connection-point add/remove call sites — closed during rebase onto the post-0013 `master`, both now call `pushSnapshot()` consistently. Verified interactively: add/delete/undo/redo cycles all correct. **Not independently verified**: drag/resize/rotate gesture grouping, and epic 0013's own connection-point interactions (dragging an edge to/from a custom point, right-clicking a small Handle to remove it) — visual/interactive, yours to check.

Process note: epic 0006 and epic 0013 were worked on in parallel (0006 branched before 0013 merged), which is what caused the gap above. Going forward, one epic in flight at a time — don't start the next epic's branch until the current one is actually merged to `master`.

Also outstanding: 0005 (dark/light), 0010/0016 (export), 0014 (drag-edge-to-create-shape), 0017 (speculative), 0019 (blocked on licensing outreach), 0020 (autosave/crash recovery), 0021 (detail frontmatter), 0022 (example gallery — better after 0003/0004 land), 0023 (metadata bucket), 0024 (tabs/windows), 0025 (copy/paste), 0026 (tagging + overlay visualization), 0027 (app branding + licensing — GPL-3.0-or-later decided and LICENSE landed, see [ADR 0011](docs/decisions/0011-software-license-choice.md); branding itself and a few licensing paperwork tasks still open).
