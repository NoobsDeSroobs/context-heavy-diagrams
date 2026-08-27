# 0070: ADRs and code comments no longer cross-reference epic numbers

## Status
Accepted (2026-08-27)

## Context

Nearly every ADR's Context section and a large share of in-code comments cited the originating epic number ("epic 0055," "see epic 0022's own Notes") as provenance — the glue tying a piece of code or a decision back to *why* it exists and what discussion produced it. That was a deliberate convention for most of the project's life.

Two things made it a liability:

1. **The epic files are slated for deletion.** The settled plan is to move `docs/planning/` out from under `docs/` and then delete most epic files under a retention rule, once this cross-reference web is gone. Every `[Epic NNNN](../planning/epics/NNNN-*.md)` link in an ADR or doc would become a dead link.
2. **ADRs and code comments should stand on their own.** A reader (third-party or otherwise) shouldn't need to open a planning doc to make sense of a comment or a decision. An epic number is opaque — it carries meaning only to someone who can look it up.

## Decision

**Strip epic-number references from ADRs, in-code comments, `docs/architecture/`, and `docs/file-format.md`.** In scope: `docs/decisions/**`, `src/**` comments (including CSS), `docs/architecture/**`, `docs/file-format.md`. Out of scope: `docs/known-issues.md` and `PROGRESS.md` (both are deliberately chronology-organized bookkeeping), and the epic files themselves.

**Removal rules, in priority order:**

1. `epic NNNN / ADR MMMM` → `ADR MMMM`. ADR-to-ADR cross-references stay — an ADR *is* the durable "why" record, and following one doesn't depend on a file that might be deleted. Where a comment lost its only "why" pointer, an ADR reference was added if one existed.
2. `[Epic NNNN](../planning/epics/NNNN-*.md)` link → the link is removed entirely and the sentence rewritten to state the problem or trigger directly ("The styling panel needs an actual schema for style…" rather than "Epic 0003 needs…").
3. Bare `(epic NNNN)` parentheticals with no "why" attached → deleted.
4. `epic NNNN` used to name a feature → replaced with the feature's own name ("the multi-connection-line work," "drag-to-open," "the threat matrix prototype").
5. Version-style references (`pre-0074 blob`, `pre-0087 filenames`) → generic ("an older blob," "old `<type>-<uuid>.md` filenames").

**Light-touch, not a full rewrite.** Where an ADR reference already covered the "why," the surrounding prose was left alone beyond the token swap. Only sentences that genuinely broke were rewritten. This kept the diff mechanical and reviewable rather than turning into a prose-quality pass on ~140 files.

**Two ADRs keep epic references as inherent to their subject:**
- [ADR 0002](0002-planning-structure.md) describes the epic/task tracking structure itself.
- [ADR 0061](0061-completed-epic-filename-marker.md) is about how completed epic files are named — its illustrative `xNNNN-title.md` was genericized, but the concept of "an epic" is the whole topic.

## Alternatives considered

- **Incremental cleanup — only touch files edited for other reasons going forward.** Rejected: the dead-link problem lands all at once when the epic files are deleted, so the cleanup has to be complete before that step, not spread over months of unrelated work.
- **Keep the epic references but make them non-links** (plain "epic 0055" text). Rejected: still opaque to a reader, and still implies a lookup that won't be possible.
- **A full self-contained rewrite** — every spot that loses an epic reference gets its "why" re-explained inline, even where an ADR already covers it. Rejected as disproportionate: much larger diff, many judgment calls, and the ADR cross-references already carry the weight.
- **Also strip `docs/known-issues.md`.** Rejected: it's a symptom-first lookup table organized around chronology and cross-links epics as part of its own "References" convention; it's a different kind of document from an ADR.

## Consequences

- ~520 references removed across ~140 files (66 ADRs, ~73 source files, architecture docs, the file-format spec).
- ADRs and code comments now read without needing `docs/planning/`. The next step (relocating `docs/planning/` and pruning old epic files) no longer creates dead links in the docs that survive.
- `typecheck` clean, `lint` 0 errors (comment-only changes).
- The READMEs under `docs/decisions/` and `docs/planning/` never actually mandated the "reference the originating epic" pattern, so neither needed updating — the pattern was habit, not written convention.
- New provenance guidance going forward: cite the ADR, not the epic. If a decision has no ADR, describe the trigger in prose.
