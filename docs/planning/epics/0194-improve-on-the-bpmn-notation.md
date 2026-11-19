# 0194: Improve on the BPMN notation: symbols, colours and shapes

## Status
Built (marks, colours, human kinds, end outcome and reach, the example) and with the maintainer. Left: the user study, and a legend row per end outcome if wanted. Logged 2026-11-18.

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
- [x] Draw all 13 kinds on one sheet, light and dark, at the canvas size and zoomed out, in greyscale and with a colour-blind simulation (`docs/experiments/behaviour-alternatives.html`: today at the top, alternatives per kind, one candidate set; open it in a browser). Picks so far: stacked layers for the sub-flow, a robot for the automatic step, a play triangle for start, a tick for end, a plain circle for the event, and for the three choices set A of round two (sideways fork, two overlapping rings, two bars; the count notations of round three were not picked). Diamonds: not taken up, since A keeps the squares. Colour rules from the maintainer: one lightness per family, evenly spaced (steps, branches and events each at their own level), so the families differ without colour and for colour-blind readers; nothing varies inside a family; shape and icon are the main differentiator; the end is not red (red reads as an error); grey is dull and hurts readability, so events are an indigo blue. Palettes on the sheet (section 6): today's, one shade per family (teal steps, amber choices, indigo events; lightness 36 / 52 / 21 in dark and 78 / 94 / 64 in light), with all five events one blue, start and end included. Still to do: the colour pick, and the marks for timer, message and repeat (their alternatives are in section 2; none picked).
- [ ] Show the kinds without the legend to a few people who do not know BPMN, ask them to name each and to say which pairs they would mix up; note the answers here.
- [x] Propose revised marks, colours and shapes for the pairs that failed and try them on the sheet (sections 3 to 9). Still to do: try them on [process-flow-all-behaviours](../../../examples/process-flow-all-behaviours.chd) when implemented.
- [x] Decide: see Decided design below. The shapes stay (choices stay square, so no change to ADR 0180's shape rule); the ADR for the new marks, colours and kinds is written with the implementation.
- [x] Implement in the kinds table and the drawing, the SVG and draw.io exports, the legend swatches, and the docs and assistant guidance that describe the marks ([ADR 0193](../../decisions/0193-behaviour-symbols-one-colour-per-family-and-an-end-that-says-how-it-ended.md)). The end's outcome and reach are built too (Properties, `add_behaviour`, `set_behaviour_ending`, file format). Not built: a legend row per outcome an end uses (the legend has one End row).
- [x] The toggle for "starts a flow" or "in the flow" on the events is specified and built in [0199](0199-event-position-toggle.md), a file-format change of its own.
- [x] Rename `step-user` to `step-human`, and its display name "User step" to "Human step" ("user" implies the people in control of the application; the step's neighbour "Automatic step" is the only reason it read as right). The rules, agreed:
  1. **Ratify the name when this is built,** not before; nothing ships until then, and an id is permanent once released.
  2. **The reader maps the old id to the new one** as it loads (the way `parseDiagram` reads `details` as `notes`), and the writer emits only `step-human`, so the rest of the code sees one id and a stale assistant skill that writes `step-user` still works. The alias stays until at least 1.0.0.
  3. **No deprecation warning:** the id is invisible to the person. A changelog note under File format, marked as a break, says the first save rewrites every user step in a file, and that an older app or a pinned CLI draws a human step as a plain step.
  4. **Released with [0199](0199-event-position-toggle.md),** so one File format section covers both. Touches the kinds table, `docs/file-format.md`, the CLI and AI guidance, the extension, `.claude/skills`, the two examples that use it, and one ADR.
- [x] Update the examples that show the kinds, with a new one, `process-flow-order-to-delivery.chd` ([ADR 0151](../../decisions/0151-every-visible-feature-has-an-example-diagram.md)).

## Decided design
Chosen by the maintainer from `docs/experiments/behaviour-alternatives.html`.
- **Steps:** the arrow shape stays. Marks: sub-flow stacked layers, automatic a robot, user a person (renamed human, see the task below), repeat the media repeat symbol (two arrows in a rounded rectangle). The plain step has none.
- **Choices:** square frames with a sideways fork for the decision, two overlapping rings for the inclusive choice, and two bars for the parallel split (set A of round two).
- **Events:** circles. Start a play triangle, end a tick (heavy ring), the plain event no mark, timer a clock, message an envelope, and the new human action a person. One ring for a start and two for an event in the flow ([0199](0199-event-position-toggle.md)); the generic start keeps one ring and the end its heavy one.
- **Colours:** one shade per family, evenly spaced in lightness so the families differ in greyscale and for colour-blind readers, nothing varying inside a family, no red: teal steps, amber choices (all three), indigo-blue events (start and end included). Lightness 36 / 52 / 21 in the dark theme and 78 / 94 / 64 in the light one; the exact fills are in the sheet's section 6, set 2.
- **Not taken up:** the count notations (1, 1+, n), the diamonds and the flowchart shapes, the raised hand and the pointer for the human action, the stopwatch, hourglass, calendar, paper plane, speech bubble and the other repeat marks.

## Notes
- **A human event is added: `event-human`, name "Human action", the person mark** (the mark of the user step, so the person always means a human). A person's act as a signal: someone files a request (a start), or the flow waits at a gate until someone approves (in the flow). It is the event twin of the user step, which is work a person does. "User" was rejected for the id because it implies the people in control of the application, while a flow often waits for a person who is part of the system or used by it (an approver, an operator, staff, a customer); "manual" was dropped for steps before and means "no system involved" in BPMN. `step-user` has the same problem but its id is released; its display name could become "Human step" without a format change, to be decided when the kinds are renamed in the picker. The raised hand was rejected because it reads as "stop". With it the event row has the generic event, timer, message and user action, plus the start and the end. Its position is the dropdown of [0199](0199-event-position-toggle.md).
- **How events are meant to be used (maintainer's rule, to go into the legend and the assistant guidance):** the start, timer and message events say what triggers or happens at that point, and any of them with no incoming edge begins a flow. The generic start (play triangle) is for when the trigger is unknown or does not matter; the timer (clock) for a timed trigger; the message (envelope) for a reaction to a message or an event. A start and an in-flow timer are told apart by position (nothing leads into a start) and by the label, not by a separate kind. The end only ever finishes its path and starts nothing, so an outgoing edge from an end is a mistake.
- **How an end finishes (decided and built):** two named states on the end, both dropdowns, both stored only when not the default, a file-format change like [0199](0199-event-position-toggle.md). *Outcome:* success (tick, default), success with warnings (tick and a small exclamation), failed (cross), aborted (stop square). *Reach:* this path (the heavy ring, default) or the whole flow (the same ring filled solid, the mark cut out), which stops every path still running at once. Reach applies to every outcome (a race won by the first path is a success that stops the rest), so "fail gracefully" and "fail hard" are a failed outcome with a narrow or a wide reach, not two outcomes. To check: whether the exclamation shows at half size, and whether an old app drawing an unknown outcome as a tick is acceptable (the changelog must say it).
- Default colours are looked up when the element is drawn and are not stored, so changing them restyles existing diagrams that have no fill of their own. Say so in the changelog.
- Kind ids are permanent once released; a kind may change its look, not its id.
- Kinds beyond the 13 (repeat variants, more events) belong to [0190](0190-behaviour-parameters-repetition-and-parallel-policy.md); a new kind should be drawn to the rules decided here.
- Out of scope: BPMN file import and export, validation of the flow, execution semantics.
