# Design decisions

ADRs (architecture decision records) for this project. **An ADR holds a principle, a foundational philosophy, a choice that was hard to make, or a decision that sets the direction of the application as a whole.** Good examples: the app is offline and private by default; the person is the focus and the tool exists to help them; the symbols of a flow say what they do and are not symmetric. Not ADRs: a label position that is a number from 0 to 1, or that the tool may not query a server (that is how the offline principle is enforced, not the principle).

Fields, gestures, preferences and how a feature behaves are not decisions of this kind. The file format is decided in [docs/file-format.md](../file-format.md), and the rest lives in the epic while it is open, then in the changelog, the entry in [completed-epics.md](../planning/completed-epics.md) and the comments next to the code. Whether something earns an ADR is the maintainer's call.

An ADR states the decision and the reasoning, not how the feature works today. When several decisions turn out to be one, they are merged into one ADR; when a decision stops being a principle, it is removed and the facts it held move to the doc that owns them.

## Format

Each file: `NNNN-short-title.md`, numbered sequentially in decision order (not necessarily chronological if superseded). **Numbers are permanent:** a number is never reused or renumbered, so a missing number is a decision that was removed (`git log --diff-filter=D -- docs/decisions` finds it). An ADR that merges several others keeps the lowest number of its group and says in one line what it replaces.

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
What this makes better and worse going forward: security, performance, maintenance and the people who use or build on it, not only the design.
```

An ADR holds the decision and the reasoning for it, and which decisions it replaces or is replaced by. It does not hold test results or a list of what is and is not verified: that is the state of the work, and lives in the epic and `PROGRESS.md` while the work is in progress.
