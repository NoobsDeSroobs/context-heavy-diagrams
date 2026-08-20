# Progress

Short pointer only — the full backlog lives in [docs/planning/](docs/planning/), decisions in [docs/decisions/](docs/decisions/).

## Documentation note (2026-08-19)

An ADR backfill pass just landed: [docs/decisions/](docs/decisions/) went from 15 to 21 entries (0016–0021), after the user flagged that ADR coverage was well behind actual decisions made — several already-merged epics (0006 undo/redo, 0011 alignment/snapping, 0012 label positioning, 0013 connection-point removal) and two foundational choices from the original brief (the Electron/React/React-Flow stack, and the "node is a single draggable entity" interaction principle) had real debated-alternatives reasoning sitting only in epic-doc prose, never promoted to a dedicated ADR. Going forward, write the ADR *while* finishing an epic with a real decision in it, not after being asked — see each epic doc for its own ADR link where one now exists.

## Design session outcome (2026-08-20)

Starting epic 0021 (detail frontmatter) triggered a real design conversation instead: frontmatter's motivations turned out to already overlap with two other planned-but-unimplemented epics (0023's metadata bucket, 0026's tagging). Working through *why* they should or shouldn't be separate mechanisms produced a unified design — one `data.metadata` field per Shape/Container/Edge, entries either free (human-added) or diagram-required (a template with optional validation/lock), with retroactive backfill and a new non-blocking diagnostics panel for when that backfill has to reset something. Full reasoning in [ADR 0022](docs/decisions/0022-unified-tag-and-metadata-system.md) (supersedes [ADR 0009](docs/decisions/0009-custom-metadata-bucket.md)); implementation checklist in [epic 0034](docs/planning/epics/0034-unified-tag-and-metadata-system.md). Epic 0021 is retired, epic 0023 is superseded, epic 0026's tag-storage design now points at 0034 instead of its own original `data.tags: string[]` sketch. Not yet implemented — this was pure design/scoping, no code written.

## Epics 0024 and 0035 done and merged (2026-08-20)

**[Epic 0024](docs/planning/epics/0024-multi-diagram-tabs-or-windows.md) (multi-window diagram model)**: separate `BrowserWindow`s per diagram, not tabs — see [ADR 0023](docs/decisions/0023-multi-window-diagram-model.md). File → New/Open and both linked-diagram navigation flows now always open a new window instead of replacing the current one; a duplicate-window guard focuses an already-open window instead of opening the same file twice. Retired epic 0009's breadcrumb back-navigation as dead code.

**[Epic 0035](docs/planning/epics/0035-propagate-required-tags-to-children.md) (copy required tags to children)**: raised ad hoc while testing 0024. A "Copy to children" button on the Required Tags panel, pushing the current diagram's `requiredTags` template down its whole link subtree — merge semantics (parent wins on conflicts), full-subtree recursion with a preview/confirmation, bounded to the current diagram's own colocation folder so an externally-linked diagram is never touched. See [ADR 0024](docs/decisions/0024-propagate-required-tags-to-children.md).

The user's own testing caught two real bugs before merge, both fixed: the external-link boundary was wrongly anchored at the diagram's containing directory instead of its colocation folder (a plain sibling `.chd` was wrongly treated as internal); and right-click "Link to diagram…" silently did nothing (a pre-existing `ContextMenu.tsx` bug, unrelated to either epic, where closing the menu after running the selected action clobbered a new menu that the action itself had just opened — fixed by closing first). Also refined the copy-to-children preview/result to list the actual relative paths involved, not just a count. Both epics merged to `master` together as PR #19.

## Epic 0026 done and merged, plus two riders (2026-08-20)

**[Epic 0026](docs/planning/epics/0026-tagging-and-overlay-visualization.md) (tagging and overlay visualization)**: match-count-dependent rendering (a single matching enabled highlight overrides an element's border/stroke; two or more show as small color chips instead), no dimming of non-matches in v1, an in-app `UtilityDock` panel rather than a second window, and split persistence (the highlight catalog — `{key, value, color}` — is saved to the file; which highlights are currently enabled is volatile, session-only state, never persisted). See [ADR 0025](docs/decisions/0025-tagging-and-overlay-visualization.md).

Two things landed on the same branch before merge, both raised ad hoc: a **fix** for File → Open always opening a new window even when the current one was completely empty (now reuses it — see [ADR 0023](docs/decisions/0023-multi-window-diagram-model.md)'s post-merge addendum and [epic 0024](docs/planning/epics/0024-multi-diagram-tabs-or-windows.md)'s Notes), and a brief **"✓ Saved" confirmation** next to the Save/Save As buttons (there was previously only ever feedback on save *failure*). Merged to `master` as PR #20.

While designing epic 0026, the user raised a related but distinct idea — a key-level "macro" highlight — and asked for it to be logged, not designed, since they wanted to think it through themselves first. They came back with a simpler proposal ("Add group": auto-generate one ordinary highlight per value used for a chosen key, grouped under a bulk on/off checkbox) that fully supersedes the original framing — see [ADR 0026](docs/decisions/0026-grouped-highlights.md) and [epic 0036](docs/planning/epics/0036-grouped-highlights.md), now being implemented.

## Current status (2026-08-20)

The "complete PoC" batch (0015, 0007, 0008, 0009) is done and merged to `master`. 0018, 0013, 0006 (selection/shortcuts, connection points, undo/redo), 0004 (containers), 0003 (styling panel), 0011 (alignment and snapping), 0014 (drag-edge-to-create-shape), and 0033 (edge reconnection) are also done and merged — see each epic's own doc for detail; not duplicated here.

**[Epic 0034](docs/planning/epics/0034-unified-tag-and-metadata-system.md) (unified tag and metadata system) is done and merged to `master`** (PR #18). The user's own click-through testing surfaced several real bugs (a permanently-open empty utility dock, a per-keystroke sync bug that left one leftover tag per letter typed while renaming a required tag, and a metadata "add" row that couldn't set a value) plus a few UX refinements (metadata grouped into Required/User/External sections, an allowed-values dropdown, a diagnostics "Recheck" button) — all fixed and merged; see the epic doc's Notes for the full list.

**Pre-agreed batch, agreed order**: ~~0004~~ → ~~0003~~ → ~~0011~~ → ~~0014~~ → ~~0034~~ → ~~0024~~ → ~~0026~~. All done and merged — the batch is complete. ~~0023~~ was superseded by 0034, dropped from the batch as its own item. Epic 0035, the empty-window-open fix, the save confirmation, and epic 0036 weren't part of this pre-agreed batch — all raised ad hoc — but 0035 and the two 0026-adjacent fixes are also done; see above.

One epic in flight at a time — don't start a new epic's branch until the current one is actually merged to `master`.

## Next up

**Epic 0036 (grouped highlights)** is in progress — design done (see [ADR 0026](docs/decisions/0026-grouped-highlights.md)), implementation starting now on `epic/0036-grouped-highlights`.

Outstanding, not yet started: 0005 (dark/light), 0010/0016 (export), 0017 (speculative), 0019 (blocked on licensing outreach), 0020 (autosave/crash recovery), epic 0022 (example gallery — not to be confused with ADR 0022 above, different numbering namespace), 0025 (copy/paste, unscoped), 0027 (app branding + licensing — GPL-3.0-or-later decided and LICENSE landed, see [ADR 0011](docs/decisions/0011-software-license-choice.md); branding itself and a few licensing paperwork tasks still open), [0028](docs/planning/epics/0028-remaining-lint-cleanup.md) (4 remaining pre-existing lint errors), [0029](docs/planning/epics/0029-drag-to-add-from-item-panel.md) (drag-to-add from the item panel), [0030](docs/planning/epics/0030-custom-style-palettes-and-defaults.md) (custom style palettes + default element styles, not yet scoped), [0031](docs/planning/epics/0031-connection-aware-alignment.md) (connection-aware alignment, not yet scoped), [0032](docs/planning/epics/0032-edge-routing-and-waypoints.md) (edge routing/waypoints so a connection can be steered around other shapes, not yet scoped — raised during 0014 testing, needs a real design conversation on the interaction model before implementing).
