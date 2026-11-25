# 0193: Behaviour symbols: one colour per family, marks of our own, and an end that says how it ended

## Status
Accepted (2026-11-19)
Amends: [0180](0180-stencils-are-light-elements-for-events-and-verbs.md) (the marks and default colours of the kinds, and the kind `step-user`, now `step-human`). The shapes of 0180 stay.
Amended by: [0198](0198-parallel-paths-are-closed-by-a-wait-and-decisions-by-a-decision.md) (the parallel kinds are a fourth colour family).
Superseded by: none

## Context
The thirteen kinds took their marks and colours from BPMN or from nowhere in particular: a cross meant a decision but also "cancel", a plus meant a parallel split but also a sub-flow, three events shared one colour and one outline, and the end leaned on red, which reads as an error and fails for some colour-blind readers. The most important distinction among the steps, a person or a machine, was the quietest. A flow also had no way to say how it ended, or that one path ending stops all the others.

## Decision
- **One colour per family, so the families differ in lightness and nothing varies inside one:** teal steps, amber choices (all three), an indigo blue for every event, start and end included. Each family has its own lightness, about the same step apart, so the three differ without colour. No red. The kind says what it is by its shape and mark, not by its colour. The light theme has its own colours per kind, used where a node has none of its own; they are not derived by flipping the dark ones, because a pale warm colour cannot be stored in the form that flips back to itself. Default colours are not stored, so existing diagrams without a fill of their own take the new ones.
- **Marks of our own, one meaning each:** a robot for the automatic step, a person for the human step and the human action, stacked layers for the sub-flow, the repeat symbol of a media player for the repeated step; a sideways fork for the decision, two overlapping rings for the inclusive choice, two bars for the parallel split or join; a solid play triangle for a start, a clock for a timer, an envelope for a message. The plain step and the plain event have none. The shapes stay as in 0180: choices are squares, so frames keep resizing and connection points.
- **A human action is a kind of its own, `event-human`:** a person's act that starts a flow, or that the flow waits for. It is the event twin of the human step. "User" was rejected for both because it suggests the people in control of the application, while the person a flow waits for is often part of the system or used by it.
- **`step-user` becomes `step-human`.** A reader maps the old id to the new one as it loads and a writer writes only the new one, so a stale assistant skill that writes the old id still works. The alias stays until 1.0.0. An older app draws a human step as a plain step.
- **An end says how it finished and how far it reaches, in two named states stored only when not the default:** `outcome` (`success`, `warnings`, `failed`, `aborted`, drawn as a tick, a tick with an exclamation mark, a cross, a stop square) and `reach` (`path`, or `flow`, which stops every path still running and is drawn as a solid disc with the mark cut out). They are separate because every outcome can have either reach: a race won by the first path is a success that stops the others, and "failing gracefully" and "failing hard" are a failed outcome with a narrow or a wide reach. A value an app does not know is drawn as the default, so an older app draws a failure as a tick; the changelog says so.
- **An event says whether it begins a flow or sits in one, in a named state `flowPosition` (`start` or `in-flow`, absent is `in-flow`), drawn with one ring or two.** It applies to the event, timer, message and human action; the plain start always starts a flow and has one ring, an end has none. It is stored, not derived from the edges, so it survives a filtered view and states the intent. A named state and not a boolean so a third can be added; a value an app does not know is drawn as `in-flow`. Set in the Properties panel as a dropdown and by assistants (`set_behaviour_position`, `flowPosition` on `add_behaviour`). The default is in the flow, so no existing diagram changes; the alternative, a start by default, would redraw every event a diagram already has.
- **How events are meant to be read:** the start, timer, message and human action name what triggers or happens at that point, and one with nothing leading into it begins a flow. A start (play triangle) is for when the trigger is unknown or does not matter. An end only finishes its path and starts nothing.

## Alternatives considered
- **Count notations for the choices (1, 1+, n),** and **diamonds** for the decisions: the digits differ by a plus, the same mix-up as before, and diamonds break the square frame. Not taken.
- **Colour inside a family** (a red end, a green start, a different blue for each choice): it says in colour what the mark already says and fails without colour.
- **A ring drawn from the edges** (one ring when nothing leads in) and **separate kinds for a starting timer and message:** the first changes with a filtered view and cannot state intent, the second doubles the kinds.
- **Five end kinds** (success, warnings, failed, fatal, aborted): the kind list grows with every outcome, and an id is permanent once released; "fatal" is a reach, not an outcome.
- **A raised hand for the human action:** it reads as "stop". A pointer: it reads as a click.
- **Keeping `step-user` and only changing its name in the picker:** the id would stay wrong for good; the rename costs one alias.

## Consequences
- The legend shows one row per kind, and for an end one row for each outcome and reach the diagram uses ("End", "End: Failed", "End: Aborted, the whole flow stops"). The rows are derived from the nodes, as before; an event's position is not a row, the swatch shows the kind's default.
- A file that uses `outcome` or `reach` or the human action shows a plain end or a step in an older app.
- Assistants set the two states with `add_behaviour` and `set_behaviour_ending`, under the same stale-edit check as every other write ([0109](0109-stale-edit-check-for-every-ai-write-path.md)).
- A later kind (a signal, an escalation) follows the same rules: its own mark, the family colour, no red.
