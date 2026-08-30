# 0066: Decouple code documentation and ADRs from epic numbering

## Status
Done (2026-08-27), on `epic/0066-decouple-docs-from-epic-numbering`, pending live test/merge. See [ADR 0070](../../../decisions/0070-decouple-docs-from-epic-numbering.md).

## Resolution of the open questions

- **Scope**: one big pass now (the epic files' deletion creates dead links all at once, so incremental doesn't work). Covered ADRs + `src/**` comments + `docs/architecture/**` + `docs/file-format.md`. Left `docs/known-issues.md` and `PROGRESS.md` alone.
- **What replaces the removed context**: `epic NNNN/ADR MMMM` → `ADR MMMM` (ADR cross-refs stay — they're the durable "why"); epic-file links removed entirely and the prose rewritten to state the trigger directly; bare provenance parentheticals deleted; feature-name references replaced with the feature's own name. Light-touch — only rewrite prose that genuinely broke.
- **ADRs specifically**: Context sections framed around "epic NNNN raised this" were reworded to state the problem directly.
- **known-issues.md / PROGRESS.md**: out of scope — both are deliberately chronology-organized.
- **READMEs**: neither `docs/decisions/README.md` nor `docs/planning/README.md` actually mandated the epic-reference pattern, so no convention change was needed. ADR 0002 and ADR 0061 keep epic references as inherent to their subject.

~520 references removed across ~140 files. `typecheck` clean, `lint` 0 errors.

## Goal
Remove references to epic numbers from in-code documentation (comments) and from ADRs — both should be able to stand on their own, understandable without needing to cross-reference `docs/planning/epics/NNNN-*.md` for context. The user's own framing: they shouldn't need to reference epics to live/make sense.

## Relevant existing behavior
Epic references are pervasive and deliberate by current convention — nearly every ADR's Context section and a large share of in-code comments cite the originating epic number (e.g. "epic 0055," "see epic 0022's own Notes") as provenance/history. This is consistent with [CLAUDE.md](../../../../CLAUDE.md)'s own documentation split: "in-code... technical/functional detail... high-level... purpose, design principles... in docs/architecture." Epic numbers currently serve as the cross-reference glue tying a piece of code back to *why* it exists and what discussion produced it.

## Real open questions (deliberately not resolved here)
- **Scope**: every single epic reference across the whole codebase (comments + all ~48 ADRs) is a large, mechanical sweep — worth deciding whether this happens as one big pass or incrementally (e.g., only touched files get cleaned up as they're edited for other reasons going forward).
- **What replaces the removed context.** An epic reference today often carries real information (why a decision was made, what came before it) — simply deleting "epic 0055" without replacing the surrounding sentence risks leaving a comment that reads as unmotivated or loses the "why." Each removal likely needs the surrounding prose rewritten to stand alone, not just the epic number stripped out.
- **ADRs specifically**: many ADR "Context" sections are framed entirely around "epic NNNN raised this because..." — removing the epic reference may mean restructuring the Context section's opening, not just deleting a phrase.
- **Does this apply to `docs/known-issues.md` and `PROGRESS.md` too**, or only to ADRs and in-code comments as stated? Both of those documents are explicitly epic/chronology-organized by design (PROGRESS.md is a pointer into the epic backlog; known-issues.md cross-links epics as part of its own "References" convention) — worth clarifying whether the ask is scoped to ADRs + code only, or the wider docs tree.
- **Interaction with `docs/decisions/README.md`/`docs/planning/README.md`'s own stated conventions** — those may need updating too if the "ADRs reference the epic that prompted them" pattern is being deliberately retired, not just cleaned up after the fact.

## Notes
Not scheduled into any current batch — logged the same day it was raised, purely so it isn't lost. Large, mechanical, and cuts across nearly the entire `docs/` tree and many source comments — likely worth its own deliberate pass rather than being folded into unrelated feature work.

**2026-08-23: a related idea raised separately, refined over a few exchanges — now settled on a real plan, sequenced after this epic.** Started as "the epics directory is getting large" (68 files, 518KB — not actually a git storage problem; `.git` itself is 3MB regardless of what `docs/planning/` holds). Refined to the real reason: epics and documentation serve entirely different audiences. Anyone using or building on this tool cares about the tool, the documentation (architecture, file-format, how to build/develop, ADRs for the *why*), and the examples — not this project's own internal development bookkeeping. Epics are that bookkeeping, nothing else, and currently sit nested under `docs/` as if they were part of the same "documentation for users" tree.

**Settled plan, in two steps, both after this epic (0066) is actually done — deliberately not now:**
1. Move `docs/planning/` (epics + tasks) out from under `docs/` entirely, to a top-level `planning/` — a structural signal, not just a README note, that this is "how we built it" rather than "documentation about it." Scoped and ready to go whenever picked up: touches 34 files / 93 link occurrences (relative paths shift depending on each linking file's own location), mechanical but not risky.
2. **Once this epic has actually removed the epic-number cross-reference web from ADRs and code**, go further than archiving — delete most epic files outright, under some retention rule ("an epic only survives so many iterations," exact rule not yet defined — e.g. keep the last N, or the last N batches). Not currently possible without real loss: right now epic docs are the *only* place a lot of granular history lives (mid-epic revisions, live-testing findings, small corrections) that never rose to its own ADR — deleting them today would genuinely lose that trail, not just tidy it away.

**The named, accepted risk, explicitly not being solved here:** losing track of the thought process behind a feature as it was originally introduced, once its epic file is gone. ADRs are supposed to be the durable "what was decided, alternatives considered, why" record (per [CLAUDE.md](../../../../CLAUDE.md)), but in practice this project has leaned on epic `## Notes` sections for a lot of that texture too — not everything worth remembering became its own ADR. Whether that gap needs closing (e.g. folding more of an epic's Notes into its related ADR(s) before deletion, on a case-by-case basis) versus just accepted as an acceptable loss is unresolved — deliberately left for whenever this is actually picked up, not decided now.
