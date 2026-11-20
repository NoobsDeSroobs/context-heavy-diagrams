# 0202: Sequence IDs and stepping through a diagram

## Status
In Progress: design decided 2026-11-20, nothing built. Logged 2026-11-20.

## Goal
Let a person give any element a sequence ID: a step, an event, a gateway, a node of any kind, an edge. Then step through the IDs and let the diagram grow: with five sequence IDs in all, show only the elements with ID 1, then those with ID 1 and 2, and so on up to the whole diagram. It paints a story: first this, then that; this is the order of the operations; this is how the landscape evolves.

## Decided
- **The number.** A new optional field `sequence` on every node and edge, a whole number from 1 up. Absent means 0, "always there"; stored only when set. Not the label (ADR 0080 uses numbers on edge labels for order, and a label is free text). Several elements may share a number, they appear together; gaps are allowed, and the steps are the numbers that are used.
- **The rule is one function.** Entering the presenter view sets the step to 0, and every step change runs the same function over the diagram: an element with `sequence` above the step is hidden, any other is shown. Hidden elements still exist in the file and in the diagram; they are only not drawn and not interactable while the view is on. The kind of an element and how it relates to the others play no part.
- **Not an edit.** The step is session state: the file is not touched, and the view works without any edit rights (so also in a view-only mode, parked as [0192](later/0192-view-only-mode.md)).

## Open questions
- **Dangling edges.** An unnumbered edge whose end is hidden would hang in the air. Proposed: an edge is also hidden when either of its ends is hidden, so an edge needs no number of its own unless it should appear later than both ends.
- **Contents of a hidden container.** Proposed: they go with it, or they would float on an empty canvas. A numbered child of a visible container needs nothing special.
- **Space and view.** Hidden elements keep their place, so nothing moves while stepping; the view stays where it is by default, with an option to fit the elements shown so far.
- **The controls.** Previous, next, the current step of the total, jump to a step, leave; keyboard shortcuts; a way in from the corner panel or a menu. Not-yet-reached elements hidden, or dimmed as an option.
- **Setting the numbers.** A field in the properties panel; a command that numbers the selection in click order; a small badge with the number on each element while editing. The assistant writers and the CLI can set and read it, with the stale-edit check ([ADR 0109](../../decisions/0109-stale-edit-check-for-every-ai-write-path.md)).
- **Exports.** One image per step, or a slide per step, is a follow-up and is not part of the first version.
- **Format.** An additive change to `schema.ts`, a MINOR bump (0.14.0 at the earliest); `docs/file-format.md` changes with it. An older app ignores the field and shows everything.

## Tasks
- [ ] ADR: the field and its meaning (0 is always there), the one visibility function, the step as session state; the alternatives (tags with a filter, numbers in labels).
- [ ] `schema.ts` and `docs/file-format.md`.
- [ ] The visibility function as one pure function in `src/shared/`, with tests for gaps, shared numbers, edges and containers.
- [ ] The presenter view: the step control, its shortcuts, hiding.
- [ ] Properties panel field, badges while editing, number-the-selection command.
- [ ] CLI, extension and assistant guidance.
- [ ] An example diagram built to be stepped through, and `examples/README.md` ([ADR 0151](../../decisions/0151-every-visible-feature-has-an-example-diagram.md)).
- [ ] Changelog under File format and Added.
