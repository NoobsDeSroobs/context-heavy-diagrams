# Design decisions

Lightweight ADRs (architecture decision records) for this project. One file per significant, hard-to-reverse decision — build tooling, state management, schema shape, etc.

Not every decision needs one. Use judgment: if reversing it later would mean redoing real work, or if we seriously debated alternatives, write it down. Small reversible choices don't need a record.

## Format

Each file: `NNNN-short-title.md`, numbered sequentially in decision order (not necessarily chronological if superseded).

```markdown
# NNNN: Title

## Status
Accepted (date)
Supersedes: NNNN, or none
Superseded by: NNNN, or none

## Context
What problem/question forced this decision.

## Decision
What we chose.

## Alternatives considered
What else was on the table, and why they lost out.

## Consequences
What this makes easier/harder going forward.
```

An ADR holds the decision and the reasoning for it, and which decisions it replaces or is replaced by. It does not hold test results or a list of what is and is not verified: that is the state of the work, and lives in the epic and `PROGRESS.md` while the work is in progress.
