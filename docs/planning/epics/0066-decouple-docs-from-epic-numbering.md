# 0066: Decouple code documentation and ADRs from epic numbering

## Status
Not Started — not yet scoped. Raised by the user (2026-08-22): "misc things to do at some point," not urgent.

## Goal
Remove references to epic numbers from in-code documentation (comments) and from ADRs — both should be able to stand on their own, understandable without needing to cross-reference `docs/planning/epics/NNNN-*.md` for context. The user's own framing: they shouldn't need to reference epics to live/make sense.

## Relevant existing behavior
Epic references are pervasive and deliberate by current convention — nearly every ADR's Context section and a large share of in-code comments cite the originating epic number (e.g. "epic 0055," "see epic 0022's own Notes") as provenance/history. This is consistent with [CLAUDE.md](../../../CLAUDE.md)'s own documentation split: "in-code... technical/functional detail... high-level... purpose, design principles... in docs/architecture." Epic numbers currently serve as the cross-reference glue tying a piece of code back to *why* it exists and what discussion produced it.

## Real open questions (deliberately not resolved here)
- **Scope**: every single epic reference across the whole codebase (comments + all ~48 ADRs) is a large, mechanical sweep — worth deciding whether this happens as one big pass or incrementally (e.g., only touched files get cleaned up as they're edited for other reasons going forward).
- **What replaces the removed context.** An epic reference today often carries real information (why a decision was made, what came before it) — simply deleting "epic 0055" without replacing the surrounding sentence risks leaving a comment that reads as unmotivated or loses the "why." Each removal likely needs the surrounding prose rewritten to stand alone, not just the epic number stripped out.
- **ADRs specifically**: many ADR "Context" sections are framed entirely around "epic NNNN raised this because..." — removing the epic reference may mean restructuring the Context section's opening, not just deleting a phrase.
- **Does this apply to `docs/known-issues.md` and `PROGRESS.md` too**, or only to ADRs and in-code comments as stated? Both of those documents are explicitly epic/chronology-organized by design (PROGRESS.md is a pointer into the epic backlog; known-issues.md cross-links epics as part of its own "References" convention) — worth clarifying whether the ask is scoped to ADRs + code only, or the wider docs tree.
- **Interaction with `docs/decisions/README.md`/`docs/planning/README.md`'s own stated conventions** — those may need updating too if the "ADRs reference the epic that prompted them" pattern is being deliberately retired, not just cleaned up after the fact.

## Notes
Not scheduled into any current batch — logged the same day it was raised, purely so it isn't lost. Large, mechanical, and cuts across nearly the entire `docs/` tree and many source comments — likely worth its own deliberate pass rather than being folded into unrelated feature work.
