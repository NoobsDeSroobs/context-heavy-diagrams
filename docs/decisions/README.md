# Design decisions

Lightweight ADRs (architecture decision records) for this project. One file per significant, hard-to-reverse decision — build tooling, state management, schema shape, etc.

Not every decision needs one. Use judgment: if reversing it later would mean redoing real work, or if we seriously debated alternatives, write it down. Small reversible choices don't need a record.

## Format

Each file: `NNNN-short-title.md`, numbered sequentially in decision order (not necessarily chronological if superseded).

```markdown
# NNNN: Title

## Status
Accepted | Superseded by NNNN

## Context
What problem/question forced this decision.

## Decision
What we chose.

## Alternatives considered
What else was on the table, and why they lost out.

## Consequences
What this makes easier/harder going forward.
```
