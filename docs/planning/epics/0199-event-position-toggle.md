# 0199: Event position: starts a flow, or in the flow

## Status
Not Started. The specification below is settled; the work is to implement it. Comes after the marks and colours of [0194](0194-improve-on-the-bpmn-notation.md) are chosen, since the toggle draws with them.

## Goal
Let a person say whether an event begins a flow or sits inside one, with a dropdown in the properties panel, and draw the difference: one ring for a start, two for an event in the flow.

## Specification
- **A new optional field on the node's data of a `stencil` node: `flowPosition`, a named state, not a boolean.** Its values are `start` and `in-flow`; the two are not each other's opposite, so a third state can be added later without reading the first two differently. Absent means `in-flow`, drawn as today, so no existing diagram changes; the field is stored only when it is not the default. An older app ignores it and draws two rings, so nothing breaks, and a value this app does not know is drawn as `in-flow` and kept when the file is saved. The name is `flowPosition`, not `position`, which the node already has for where it sits on the canvas.
- **Which kinds have it:** every event kind except the generic start and the end, i.e. `event`, `event-timer`, `event-message`, `event-human` (see 0194) and any later trigger kind. The generic start (play triangle) always starts a flow and always has one ring; the end has its heavy ring and has no position. Allowing the generic start to sit inside a flow (a "sub-process starts") is left out and can be added later by giving that kind the field; nothing in the format stands in the way. Changing a node to a kind without a position ignores the field and clears it.
- **The panel:** a "Position" row with a dropdown, never a checkbox, holding **Starts a flow** and **In the flow**, shown only for the kinds above. One undo step per change.
- **Drawing:** `start` draws the circle with one ring, `in-flow` with the second inner ring. The canvas, the legend swatches, the SVG and PNG exports and the draw.io export all read the same flag; a legend entry shows the kind's default (in the flow).
- **Copy, paste and duplicate keep it.** It is not derived from the edges and not checked against them here; a check that flags a start with an incoming edge, an in-flow event with none, or an end with an outgoing edge is parked as [0198](later/0198-flow-checks-for-start-and-end-events.md).
- **Writers:** the CLI, the extension's `edit_diagram` and the assistant guidance can set it; the write paths keep their stale-edit check ([ADR 0109](../../decisions/0109-stale-edit-check-for-every-ai-write-path.md)). The guidance says how the event kinds are meant to be used (see 0194's notes).
- **Format:** an additive change, a MINOR bump with the next release; `docs/file-format.md` and `schema.ts` change together.

## Tasks
- [ ] ADR: the field, the kinds it applies to, why stored and not derived from edges (it survives a filtered view and states intent), why a named state and not a boolean, and the alternatives (a ring drawn from the edges; separate kinds for a starting timer and message)
- [ ] `schema.ts` and `docs/file-format.md`
- [ ] Properties panel row, with a test
- [ ] Canvas and legend drawing, the SVG, PNG and draw.io exports
- [ ] CLI, extension and assistant guidance
- [ ] An example diagram that shows a timer start next to an in-flow timer, and `examples/README.md` ([ADR 0151](../../decisions/0151-every-visible-feature-has-an-example-diagram.md))
- [ ] Changelog under File format and Added
