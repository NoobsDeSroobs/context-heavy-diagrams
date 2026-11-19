# 0194: Improve on the BPMN notation: symbols, colours and shapes

## Status
Not Started. Logged 2026-11-18. Sparse on purpose: look at the kinds side by side and find out what gets mixed up before changing anything.

## Goal
Make the Behaviour elements (steps, choices, events) easier to grasp at a glance and harder to misread or mis-pick, by choosing their marks, colours and shapes better than BPMN does. BPMN stays a source of vocabulary, not a standard to follow ([ADR 0080](../../decisions/0080-bpmn-as-adopted-vocabulary-not-metamodel.md), [ADR 0180](../../decisions/0180-stencils-are-light-elements-for-events-and-verbs.md)): where its symbols are hard to learn or easy to confuse, we draw our own.

## What there is today
The table is `src/shared/stencils/kinds.ts`; the file stores only the kind id, so marks, colours and shapes can change without a file format change.

| Family | Kinds | Shape | Colour | Mark |
| --- | --- | --- | --- | --- |
| Steps | step, user, automatic, sub-flow, repeat | rectangle with an arrow band on the left | one teal for all | in a small slot on the right (person, gear, square-plus, loop) |
| Branches | decision, inclusive, parallel | square | amber, amber, blue | cross, ring, plus |
| Events | start, event, timer, message, end | circle | green, one indigo for three, red | none, none, clock, envelope, none |

## Suspected confusions (to check by eye and with other people, not assumed)
- **Decision and inclusive choice share a colour**; only a cross and a ring tell them apart, and a cross also reads as "cancel" or "error".
- **The plus means two things:** parallel split or join, and an expandable sub-flow (BPMN has the same clash).
- **Event, timer and message are one colour and one outline**; only the small mark differs, and a plain event has none.
- **Start and end lean on red against green**, which fails for some colour-blind readers; the end's heavy border is the only other cue.
- **User and automatic steps differ only by a 20 px mark** next to the label, at the same colour: the difference that matters most in a process (a person, or a machine) is the quietest.
- **Squares for choices lose the diamond**, the one BPMN shape people already know; ADR 0180 dropped non-rectangular outlines for resizing, connection points and containment, but a circle already sits in a square frame, and a diamond would too. Worth testing whether it can, since the vertices fall on the frame's side midpoints.
- **Labels outside the small shapes** can drift from their shape when several sit close together.
- Whether the set reads in the light theme, in greyscale print, zoomed out, and in a legend swatch.

## Principles to hold the options against
- Never colour alone: shape or mark carries the meaning too.
- One meaning per mark across the whole set.
- Kinds that are likely to be mistaken for each other sit far apart in shape, colour and mark; kinds that are siblings look related (a family colour, a shared outline).
- The most important distinction in a family is the most visible one.
- Our own drawings, nothing copied from the specification.

## Tasks
- [x] Draw all 13 kinds on one sheet, light and dark, at the canvas size and zoomed out, in greyscale and with a colour-blind simulation (`docs/experiments/behaviour-alternatives.html`: today at the top, alternatives per kind, one candidate set; open it in a browser). Picks so far: stacked layers for the sub-flow, a robot for the automatic step, a play triangle for start, a tick for end, a plain circle for the event, and for the three choices set A of round two (sideways fork, two overlapping rings, two bars; the count notations of round three were not picked). Diamonds: not taken up, since A keeps the squares. Colour rules from the maintainer: the families must differ in lightness so they differ without colour, shape and icon are the main differentiator, and the end is not red (red reads as an error), so neutral. Palettes on the sheet (section 6): today's, three families at three lightness levels, the same with the actor as a shade, and with a green-tinted start; lightness values are printed under each. Still to do: the colour pick, and the marks for timer, message and repeat (their alternatives are in section 2; none picked).
- [ ] Show the kinds without the legend to a few people who do not know BPMN, ask them to name each and to say which pairs they would mix up; note the answers here.
- [ ] Propose revised marks, colours and shapes for the pairs that failed, and try them on the same sheet and on [process-flow-all-behaviours](../../../examples/process-flow-all-behaviours.chd).
- [ ] Decide, including whether choices become diamonds (an ADR that supersedes the shape part of 0180 if so).
- [ ] Implement in the kinds table and the drawing, then the legend, the SVG and draw.io exports, and the docs and assistant guidance that describe the marks.
- [ ] Update the examples that show the kinds ([ADR 0151](../../decisions/0151-every-visible-feature-has-an-example-diagram.md)).

## Notes
- Default colours are looked up when the element is drawn and are not stored, so changing them restyles existing diagrams that have no fill of their own. Say so in the changelog.
- Kind ids are permanent once released; a kind may change its look, not its id.
- Kinds beyond the 13 (repeat variants, more events) belong to [0190](0190-behaviour-parameters-repetition-and-parallel-policy.md); a new kind should be drawn to the rules decided here.
- Out of scope: BPMN file import and export, validation of the flow, execution semantics.
