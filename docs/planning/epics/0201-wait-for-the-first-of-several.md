# 0201: Waiting for the first of several, and joins that wait for some

## Status
Not Started. Logged 2026-11-19. Later in the batch, after [0194](0194-improve-on-the-bpmn-notation.md), [0199](0199-event-position-toggle.md) and [0200](0200-symbol-styles-chd-and-minimalist.md). Design and mockup first; no code in the pull request that holds 0194 and 0199.

## Goal
Let a diagram say that a flow waits for whichever of several things happens first (a confirmation or a timeout), and how many of the parallel paths a join waits for (all, any one, at least n of m).

## Two separate things
- **A race between events, drawn at the split.** Today a decision followed by two events reads as "someone evaluates a condition", and a plain split followed by a merge does not say that the loser is cancelled, so the next step looks as if it runs twice. The case:

  ```
  [Send request] → <⏳> ─ (✉ Confirmed)    ─┐
                       └ (⏱ after 3 days) ─┴→ [Complete]
  ```

  Proposal: one new kind in the choice family, **Wait for the first of** (`branch-event`), the choice square in the choice colour with an hourglass mark. Each exit goes to an event (message, timer, human action); the first to happen continues, the others are cancelled. n exits is waiting for any of n. The exits may lead to one step (no closing merge needed, since the loser is cancelled) or to different ones (confirmed goes on, timeout escalates).
- **A join that waits for some of its paths, drawn at the join.** The parallel join means all, the inclusive join all that were started. Neither says "any one" or "2 of 3". Proposal: not a kind per variant but a property on the join, stored only when not the default like an end's outcome and reach (a named state, [0199](0199-event-position-toggle.md)): **Waits for** *All paths* (default), *Any one path*, *At least N paths*, with the count stored for the last.

## Open design questions (to settle on the mockup)
- **How the count is shown** on the join: a subscript or badge such as ≥ 1/n, a plain number replacing the bars, or only the label text. The first number drawn inside a stencil, so it needs the drawing work and the mockup before any decision. Compare with the other counts already rejected in 0194 (1, 1+, n).
- **What happens to the paths still running when the join fires:** cancelled (a race) or left to finish and ignored. Both are real; a second named state, or one of them dropped. Overlaps the end's reach in [0194](0194-improve-on-the-bpmn-notation.md); see whether one word can serve both.
- **The hourglass:** it reads as "waiting" but also as a timer; check it against the clock of the timer event, and against the three other choice marks, on the sheet.
- **Where the parameter lives.** The count is the typed parameter that [0190](0190-behaviour-parameters-repetition-and-parallel-policy.md) asks about; decide the two together, or let this one settle it.
- **The exits as events only** is a rule for a later flow check ([0198](later/0198-flow-checks-for-start-and-end-events.md)), not for the file.

## Scope
Documenting what a flow means, not executing it. Kind ids are permanent once released, so the id is chosen with the mockup. An additive file-format change (a new kind id; a new optional field), with `docs/file-format.md`, the SVG and draw.io exports, the legend, search, compare, the CLI, the extension and the assistant guidance, and an example ([ADR 0151](../../decisions/0151-every-visible-feature-has-an-example-diagram.md)). The write paths keep their stale-edit check ([ADR 0109](../../decisions/0109-stale-edit-check-for-every-ai-write-path.md)).

## Tasks
- [ ] Mock the race (hourglass kind with the converging and the diverging example) and the join with each way of showing the count, light and dark, at canvas size and zoomed out, on the sheet `docs/experiments/behaviour-alternatives.html`.
- [ ] Decide with 0190 where the parameter lives; an ADR.
- [ ] Implement the kind and the join property: `kinds.ts`, `schema.ts`, drawing, exports, panel, tools, guidance, file-format doc.
- [ ] An example that uses both, and `examples/README.md`.
- [ ] Changelog under Added and File format.
