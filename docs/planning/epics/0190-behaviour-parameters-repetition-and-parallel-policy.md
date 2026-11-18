# 0190: Behaviour parameters: repetition and parallel policy

## Status
Not Started. Logged 2026-11-16. Target: a design pass for 0.13.0.

## Goal
Say how a repeated step repeats and how parallel branches are judged, without turning the tool into a process engine.

## Open questions (the design pass)
- **Repetition.** A repeated step should say which: a number of times, until a condition holds, while one holds, once for each item, forever. As kinds (`step-repeat-count`, `step-repeat-until`, …, with the number or condition in the label) or as one kind with a small parameter shown on the shape (`×3`, `until paid`)?
- **Parallel policy.** A join that is done when all branches succeed, when at least n of m do, when the first does; and what happens on a failure: stop the rest, carry on, warn, inform. Which of these belong on the join, which on the split, and which are already an edge (a dashed edge labelled "on failure" to an "inform" step)?
- **One question under both:** may a kind carry a small typed parameter (a number, a short condition), against the rule that a behaviour carries only a label and its kind? Both asks need one. If yes, the parameter is stored and drawn as a badge, searched, compared and settable by assistants like any field.
- **Scope.** Documenting what a flow means, not executing it. The test for each addition is that a reader of the diagram would otherwise be told in the label, and that two diagrams would otherwise say it two ways.
- **The existing `step-repeat`.** Ids are permanent once released, and `step-repeat` has been since 0.11.0. Adding specific kinds later is free; the plain `step-repeat` stays.

## Tasks
- [ ] Collect real examples of repetition and parallel policy from the maintainer's own flows, before designing.
- [ ] Decide kinds against parameters; an ADR.
- [ ] Implement, with file format, exports, search, compare, tools and an example.
