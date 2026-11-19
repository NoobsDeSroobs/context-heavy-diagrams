# 0199: Event position toggle: starts a flow, or in the flow

## Status
Not Started. The specification below is settled; the work is to implement it. Comes after the marks and colours of [0194](0194-improve-on-the-bpmn-notation.md) are chosen, since the toggle draws with them.

## Goal
Let a person say whether an event begins a flow or sits inside one, in the properties panel, and draw the difference: one ring for a start, two for an event in the flow.

## Specification
- **A new optional field on the node's data of a `stencil` node: `startsFlow`, a boolean.** Absent means false: in the flow, drawn as today, so no existing diagram changes. Stored only when true. An older app ignores it and draws two rings, so nothing breaks.
- **Which kinds have it:** every event kind except the generic start and the end, i.e. `event`, `event-timer`, `event-message` and any later trigger kind (a human event is under discussion in 0194). The generic start (play triangle) always starts a flow and always has one ring; the end has its heavy ring and no toggle. Changing a node to a kind without the toggle ignores the field and clears it.
- **The panel:** a "Position" row with two choices, **Starts a flow** and **In the flow**, shown only for the kinds above. One undo step per change.
- **Drawing:** `startsFlow` true draws the circle with one ring, false with the second inner ring. The canvas, the legend swatches, the SVG and PNG exports and the draw.io export all read the same flag; a legend entry shows the kind's default (in the flow).
- **Copy, paste and duplicate keep it.** It is not derived from the edges and not checked against them here; a check that flags a start with an incoming edge, an in-flow event with none, or an end with an outgoing edge is parked as [0198](later/0198-flow-checks-for-start-and-end-events.md).
- **Writers:** the CLI, the extension's `edit_diagram` and the assistant guidance can set it; the write paths keep their stale-edit check ([ADR 0109](../../decisions/0109-stale-edit-check-for-every-ai-write-path.md)). The guidance says how the event kinds are meant to be used (see 0194's notes).
- **Format:** an additive change, a MINOR bump with the next release; `docs/file-format.md` and `schema.ts` change together.

## Tasks
- [ ] ADR: the field, the kinds it applies to, why stored and not derived from edges (it survives a filtered view and states intent), and the alternatives (a ring drawn from the edges; separate kinds for a starting timer and message)
- [ ] `schema.ts` and `docs/file-format.md`
- [ ] Properties panel row, with a test
- [ ] Canvas and legend drawing, the SVG, PNG and draw.io exports
- [ ] CLI, extension and assistant guidance
- [ ] An example diagram that shows a timer start next to an in-flow timer, and `examples/README.md` ([ADR 0151](../../decisions/0151-every-visible-feature-has-an-example-diagram.md))
- [ ] Changelog under File format and Added
