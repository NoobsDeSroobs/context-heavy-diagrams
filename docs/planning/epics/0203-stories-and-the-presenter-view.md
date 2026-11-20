# 0203: Stories and the presenter view

## Status
Not Started. Design decided 2026-11-20; builds on [0202](0202-visibility-sets.md) and waits for it.

## Goal
Tell a diagram as a story: first this, then that. "This is what we have today", "this is how it is connected now", "to fix the integration problem we can connect it like this". A story is a sequence of steps over the visibility sets of 0202, stepped through in a presenter view that grows, and shrinks, the diagram one step at a time.

## Decided
- **A story is an ordered list of steps; a step is a list of operations**, such as "show today" or "hide today, show proposed". The operations are cumulative: the state at step n is the result of applying steps 1 to n in order, starting from the state before step 1. Stepping back or jumping to a step is a replay, and inserting a step does not mean redoing the later ones.
- **Before step 1.** Every set the story names starts hidden, so only the elements in no set are shown. A story can say otherwise.
- **The presenter view.** Entering it sets the step to 0; next and previous change the step and run the one visibility function of 0202 over the diagram. Hidden elements still exist but nothing is interactable in the view.
- **Session state.** The current step is not saved and is not an edit. The stories themselves are authored content and go in the `.chd` file.
- **Exports** draw the current step (see 0202).
- **A shortcut for the simplest story.** Number elements 1, 2, 3 and get one set per number and a story that shows the next set at each step and hides nothing.

## Open questions
- **Several stories in one diagram,** each with a name, or one.
- **How a story is written.** A step editor beside the sets panel that shows the state after each step; recording a story by toggling sets and pressing "add step".
- **The controls.** Previous, next, the step of the total, jump to a step, leave; keyboard shortcuts; whether the view fits what is shown or stays where it is; a short caption for each step ("this is what we have today") shown in the view.
- **Exports of a whole story,** one image per step or a slide per step, is a follow-up and is not part of the first version.
- **Format.** An additive change to `schema.ts`, a MINOR bump; `docs/file-format.md` changes with it. An older app ignores the stories.

## Tasks
- [ ] ADR: the story and its steps as operations, accumulation from a start state, the presenter view, and the alternatives (a snapshot of the visible sets at each step).
- [ ] `schema.ts` and `docs/file-format.md`.
- [ ] The state at a step as one pure function in `src/shared/`, with tests for accumulation, hide and show in one step, jumping and going back.
- [ ] The presenter view: the controls, the shortcuts, no interaction.
- [ ] The step editor and recording.
- [ ] The numbered shortcut.
- [ ] CLI, extension and assistant guidance.
- [ ] An example diagram with a story, and `examples/README.md` ([ADR 0151](../../decisions/0151-every-visible-feature-has-an-example-diagram.md)).
- [ ] Changelog under File format and Added.
