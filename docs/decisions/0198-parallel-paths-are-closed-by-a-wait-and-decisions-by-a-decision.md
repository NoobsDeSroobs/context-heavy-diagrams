# 0198: Parallel paths are closed by a wait, decisions by a decision

## Status
Accepted (2026-11-25)
Amends: [0193](0193-behaviour-symbols-one-colour-per-family-and-an-end-that-says-how-it-ended.md) (four colour families, not three) and [0180](0180-stencils-are-light-elements-for-events-and-verbs.md) (the one kind "Parallel split or join" is now three).
Superseded by: none

## Context
A flow can fork in two ways that BPMN draws with one symbol family: a **decision** takes one way (or, for the inclusive choice, some), and a **parallel** fork takes every way. What happens where the ways meet again is different too: a decision's ways need a merge, while parallel ways are waited for, either all of them or the first.

Drawn with one symbol that opens and closes, a flow can be miswired in a way the picture hides. A split into three paths closed by a join with four arrows in, one of them from a decision's second way, looks balanced by eye but waits for an arrow that is never sent.

## Decision
- **Two families, told apart by name, colour and mark.** Decisions (Decision, Inclusive choice) stay amber. The parallel family (Run in parallel, Wait for all, Wait for first) is plum, a hue no other family has, and darker than the others in both themes, so it also differs in grayscale. Its marks are two bars, two lines meeting, and a long line over a short one.
- **The recommended convention is a hybrid.** A decision is closed by a decision symbol: the ways go into one, then on. Parallel ways are opened by **Run in parallel** and closed by a wait: **Wait for all** (the flow goes on when every path has arrived) or **Wait for first** (when the first has).
- **A gateway is a split or a join by its arrows, not by its symbol.** So the symmetric style also works: Run in parallel with several arrows in closes its own paths (and), and Wait for first can open and close a race (or). It is accepted and not advised: a name says what the symbol does in one position, and in the other the reader has to know the convention.
- **The ids stay `branch-parallel`, `branch-all` and `branch-one`.** Only the names changed ("Pick all" and "Pick one" are still search words). An id is permanent once released, so a kind left out later stays as a hidden alias that still draws.
- **The validator warns on the one mistake the hybrid leaves open:** two ways of one decision meeting at a join that waits for all its arrows (Wait for all, or Run in parallel with several arrows in), with nothing between them that gathers them into one (a decision symbol, a Wait for first, or a step that takes several arrows). It only warns; a drawing is never refused.

## Alternatives considered
- **One symbol that closes what it opened, for every gateway (pure BPMN).** The mistake above cannot be made by accident, but a closing symbol looks like the opening one, so a person must trace the arrows to know whether paths are waited for or merged. Kept as an accepted style, not the recommended one.
- **Parallel paths and decisions both closed by waits (no merge for a decision).** Rejected: a join waits for every arrow into it, so a decision's unused way is waited for forever, and the arrow count at the join differs from the split's in a way that looks wrong and is right.
- **One colour for all gateways.** They would differ by mark only, which is what let decision and parallel be confused.
- **A red or green family.** Red reads as an error; green is close to the teal steps and to success.

## Consequences
- Both conventions are valid, so a diagram may mix them; the legend, the file format and the assistant instructions name each kind's role in both positions.
- The validator cannot judge a flow it does not execute: a join reached through a loop or through paths it cannot see is not judged.
- A saved diagram keeps drawing as before; the names in it that were written by hand ("Pick all") are only labels.
