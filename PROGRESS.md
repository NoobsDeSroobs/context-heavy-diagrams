# Progress

Short pointer only — the full backlog lives in [docs/planning/](docs/planning/), decisions in [docs/decisions/](docs/decisions/).

## Documentation note (2026-08-19)

An ADR backfill pass just landed: [docs/decisions/](docs/decisions/) went from 15 to 21 entries (0016–0021), after the user flagged that ADR coverage was well behind actual decisions made — several already-merged epics (0006 undo/redo, 0011 alignment/snapping, 0012 label positioning, 0013 connection-point removal) and two foundational choices from the original brief (the Electron/React/React-Flow stack, and the "node is a single draggable entity" interaction principle) had real debated-alternatives reasoning sitting only in epic-doc prose, never promoted to a dedicated ADR. Going forward, write the ADR *while* finishing an epic with a real decision in it, not after being asked — see each epic doc for its own ADR link where one now exists.

## Design session outcome (2026-08-20)

Starting epic 0021 (detail frontmatter) triggered a real design conversation instead: frontmatter's motivations turned out to already overlap with two other planned-but-unimplemented epics (0023's metadata bucket, 0026's tagging). Working through *why* they should or shouldn't be separate mechanisms produced a unified design — one `data.metadata` field per Shape/Container/Edge, entries either free (human-added) or diagram-required (a template with optional validation/lock), with retroactive backfill and a new non-blocking diagnostics panel for when that backfill has to reset something. Full reasoning in [ADR 0022](docs/decisions/0022-unified-tag-and-metadata-system.md) (supersedes [ADR 0009](docs/decisions/0009-custom-metadata-bucket.md)); implementation checklist in [epic 0034](docs/planning/epics/0034-unified-tag-and-metadata-system.md). Epic 0021 is retired, epic 0023 is superseded, epic 0026's tag-storage design now points at 0034 instead of its own original `data.tags: string[]` sketch. Not yet implemented — this was pure design/scoping, no code written.

## Current status (2026-08-20)

The "complete PoC" batch (0015, 0007, 0008, 0009) is done and merged to `master`. 0018, 0013, 0006 (selection/shortcuts, connection points, undo/redo), 0004 (containers), 0003 (styling panel), 0011 (alignment and snapping), 0014 (drag-edge-to-create-shape), and 0033 (edge reconnection) are also done and merged — see each epic's own doc for detail; not duplicated here.

**[Epic 0034](docs/planning/epics/0034-unified-tag-and-metadata-system.md) (unified tag and metadata system) implementation is done**, branch `epic/0034-unified-tag-and-metadata-system`, not yet merged to `master`. `npm run typecheck` and `npm run lint` are clean (lint's 4 remaining errors are epic 0028's pre-existing ones, not new). Not yet manually clicked through in the running app — see the epic doc's Notes for the pre-merge checklist.

**Next batch, agreed order**: ~~0004~~ → ~~0003~~ → ~~0011~~ → ~~0014~~ → ~~0034~~ (done, see above — pending merge) → **0024** (multi-diagram tabs/windows, up next) → 0026 (tagging and overlay visualization, depends on 0034). ~~0023~~ is superseded by 0034, dropped from the batch as its own item.

One epic in flight at a time — don't start the next epic's branch until the current one is actually merged to `master`. Two epics later in this batch aren't fully scoped yet and will need a real design pass when their turn comes, not just implementation: **0024** (marked "not yet scoped" — no design exists) and **0026** (mostly scoped, but several technical questions were deliberately deferred — see its Notes).

## Next up

**Merge epic 0034**, once manually verified — then **0024** (multi-diagram tabs/windows) is next in the batch, but it needs a real design conversation first (no scoping exists yet), not straight-to-implementation.

Also outstanding, not in this batch: 0005 (dark/light), 0010/0016 (export), 0017 (speculative), 0019 (blocked on licensing outreach), 0020 (autosave/crash recovery), epic 0022 (example gallery — not to be confused with ADR 0022 above, different numbering namespace), 0025 (copy/paste, unscoped), 0027 (app branding + licensing — GPL-3.0-or-later decided and LICENSE landed, see [ADR 0011](docs/decisions/0011-software-license-choice.md); branding itself and a few licensing paperwork tasks still open), [0028](docs/planning/epics/0028-remaining-lint-cleanup.md) (4 remaining pre-existing lint errors), [0029](docs/planning/epics/0029-drag-to-add-from-item-panel.md) (drag-to-add from the item panel), [0030](docs/planning/epics/0030-custom-style-palettes-and-defaults.md) (custom style palettes + default element styles, not yet scoped), [0031](docs/planning/epics/0031-connection-aware-alignment.md) (connection-aware alignment, not yet scoped), [0032](docs/planning/epics/0032-edge-routing-and-waypoints.md) (edge routing/waypoints so a connection can be steered around other shapes, not yet scoped — raised during 0014 testing, needs a real design conversation on the interaction model before implementing).
