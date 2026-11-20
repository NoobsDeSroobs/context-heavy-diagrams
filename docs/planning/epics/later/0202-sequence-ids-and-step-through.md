# 0202: Sequence IDs and stepping through a diagram

## Status
Not Started. Parked. Logged 2026-11-20.

## Goal
Let a person give any element a sequence ID: a step, an event, a gateway, a node of any kind, an edge. Then step through the IDs and let the diagram grow: with five sequence IDs in all, show only the elements with ID 1, then those with ID 1 and 2, and so on up to the whole diagram. For telling a process or an architecture one piece at a time, to an audience or to oneself.

## Open questions
- **What the number is.** A new optional field on nodes and edges, `sequence`, a positive whole number; absent means "not part of the sequence". Not the label, since ADR 0080 uses numbers on edge labels for order and a label is free text. Several elements may share a number (they appear together); gaps are allowed (1, 2, 5), and the steps are the numbers that are used, not the integers in between.
- **Elements without a number.** Always shown, so a frame (containers, notes, legend) stays put while the sequenced parts appear? Or hidden until the end? Probably always shown, with a way to hide them too.
- **Edges and their ends.** An edge is shown when its own number is reached and both ends are shown; an edge without a number follows its ends. What an edge with a number lower than one of its ends does is decided in the design pass (shown dangling, or held back).
- **Containers.** A child with a number inside a container without one: the container is there from the start. A container with a number brings its children only when they are numbered too, or all at once? Decide with the rule above.
- **How it shows.** A step control in the corner panel or a presenter mode: previous, next, the current number of the total, jump to a number, back to the whole diagram; keyboard shortcuts. Elements not yet reached are hidden, or dimmed as an option (the audience sees what is coming).
- **Relation to existing views.** Highlights, isolate, search and the filter by tag already hide or dim things; the step view is one more input to the same machinery, not a second one. It is session state, not an edit, so it works in a view-only mode (parked as [0192](0192-view-only-mode.md)) and does not touch the file.
- **Setting the numbers.** A field in the properties panel; a command that numbers the selection in click order; a way to see all numbers at once (a small badge on each element while editing). The assistant writers and the CLI can set and read it, with the stale-edit check ([ADR 0109](../../../decisions/0109-stale-edit-check-for-every-ai-write-path.md)).
- **Output.** Exporting one image per step (a series of PNG or SVG files), or a slide per step, is a natural follow-up and is not part of the first version.
- **Format.** An additive change to `schema.ts`, a MINOR bump; `docs/file-format.md` changes with it. An older app ignores the field and shows everything.

## Tasks
- [ ] Design pass on the questions above; an ADR (what the number is, what an unnumbered element and an edge do).
- [ ] `schema.ts` and `docs/file-format.md`.
- [ ] The visibility rule as one pure function in `src/shared/`, with tests for gaps, shared numbers, edges and containers.
- [ ] The step control and its keyboard shortcuts; hide or dim.
- [ ] Properties panel field, badges while editing, number-the-selection command.
- [ ] CLI, extension and assistant guidance.
- [ ] An example diagram built to be stepped through, and `examples/README.md` ([ADR 0151](../../../decisions/0151-every-visible-feature-has-an-example-diagram.md)).
- [ ] Changelog under File format and Added.
