# Progress

Short pointer only — the full backlog lives in [docs/planning/](docs/planning/), decisions in [docs/decisions/](docs/decisions/).

## Documentation note (2026-08-19)

An ADR backfill pass just landed: [docs/decisions/](docs/decisions/) went from 15 to 21 entries (0016–0021), after the user flagged that ADR coverage was well behind actual decisions made — several already-merged epics (0006 undo/redo, 0011 alignment/snapping, 0012 label positioning, 0013 connection-point removal) and two foundational choices from the original brief (the Electron/React/React-Flow stack, and the "node is a single draggable entity" interaction principle) had real debated-alternatives reasoning sitting only in epic-doc prose, never promoted to a dedicated ADR. Going forward, write the ADR *while* finishing an epic with a real decision in it, not after being asked — see each epic doc for its own ADR link where one now exists.

## Current status (2026-08-19)

The "complete PoC" batch (0015, 0007, 0008, 0009) is done and merged to `master`. 0018, 0013, 0006 (selection/shortcuts, connection points, undo/redo), 0004 (containers), 0003 (styling panel), and 0011 (alignment and snapping) are also done and merged — see each epic's own doc for detail; not duplicated here.

**[Epic 0014](docs/planning/epics/0014-drag-edge-to-create-shape.md) (drag-edge-to-create-shape) and [epic 0033](docs/planning/epics/0033-edge-reconnection.md) (edge reconnection)** are both implemented on branch `epic/0014-drag-edge-to-create-shape`, not yet merged. **User has manually verified the core drag mechanics for both — confirmed working.** Two bugs found during that testing, both in the reconnect-drop-into-void path specifically, both now fixed but not yet re-verified live: (1) two edges ended up connected to the spawned anchor instead of one (React Flow fires both the generic connect handlers and the reconnect-specific ones for the same gesture); (2) once fixed, the anchor attached to the *wrong* end of the edge — React Flow's `handleType` argument describes the fixed/opposite end, not the one actually dragged, easy to misread the first time. See epic 0033's Implementation notes for both root causes. Ready to merge once re-verified.

**Next batch, agreed order**: ~~0004~~ → ~~0003~~ → ~~0011~~ → ~~0014~~ → **0021** (detail frontmatter) → 0024 (multi-diagram tabs/windows) → 0023 (custom metadata bucket) → 0026 (tagging and overlay visualization).

One epic in flight at a time — don't start the next epic's branch until the current one is actually merged to `master`. Two epics later in this batch aren't fully scoped yet and will need a real design pass when their turn comes, not just implementation: **0024** (marked "not yet scoped" — no design exists) and **0026** (mostly scoped, but several technical questions were deliberately deferred — see its Notes).

## Next up

**Epic 0014/0033 need the anchor-duplication bug fix re-verified, then merge to `master`**, before a fresh session starts 0021 (detail frontmatter) — see the batch order above.

Also outstanding, not in this batch: 0005 (dark/light), 0010/0016 (export), 0017 (speculative), 0019 (blocked on licensing outreach), 0020 (autosave/crash recovery), 0022 (example gallery), 0025 (copy/paste, unscoped), 0027 (app branding + licensing — GPL-3.0-or-later decided and LICENSE landed, see [ADR 0011](docs/decisions/0011-software-license-choice.md); branding itself and a few licensing paperwork tasks still open), [0028](docs/planning/epics/0028-remaining-lint-cleanup.md) (4 remaining pre-existing lint errors), [0029](docs/planning/epics/0029-drag-to-add-from-item-panel.md) (drag-to-add from the item panel), [0030](docs/planning/epics/0030-custom-style-palettes-and-defaults.md) (custom style palettes + default element styles, not yet scoped), [0031](docs/planning/epics/0031-connection-aware-alignment.md) (connection-aware alignment, not yet scoped), [0032](docs/planning/epics/0032-edge-routing-and-waypoints.md) (edge routing/waypoints so a connection can be steered around other shapes, not yet scoped — raised during 0014 testing, needs a real design conversation on the interaction model before implementing).
