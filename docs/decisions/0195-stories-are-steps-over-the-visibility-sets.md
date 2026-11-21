# 0195: Stories are steps over the visibility sets

## Status
Accepted (2026-11-21), and kept up to date as the design is tried.
Builds on: [0194](0194-visibility-sets-hide-and-show-parts-of-a-diagram.md) (the rule that decides what is visible, and sets as session state), [0118](0118-saved-with-version-marker.md) (what an older application does with a field it does not know), [0109](0109-stale-edit-check-for-every-ai-write-path.md).
Supersedes: none
Superseded by: none

## Context
Visibility sets let one diagram hold several pictures, but a person tells a diagram in order: "this is what we have today", then "this is how it is connected", then "this is how we could fix it". Toggling sets by hand while talking is slow and easy to get wrong, and the order lives only in the presenter's head.

## Decision
- **A story is an ordered list of steps over the visibility sets.** A new optional diagram-level field `stories`, a list of `{ id, name, steps }`, left out of the file when empty. The id is opaque and unique among the stories and never shown; the name is free text, unique ignoring case (the editor refuses a duplicate, the file does not enforce it). A diagram can hold several stories, so one diagram can serve more than one audience. The order of the stories and of the steps is kept.
- **A step is `{ show?, hide? }`, two lists of set ids**, each left out when empty. A step hides the sets in `hide`, then shows the sets in `show`, so a set in both ends shown. The editor never writes a set into both.
- **Steps accumulate.** The state at step n is the state before step 1 with steps 1 to n applied in order. Step 0 is the state before step 1: every set the story names is hidden and every other set is shown. The state depends only on the step number, so going back or jumping to a step is a replay from step 0, and inserting a step does not mean redoing the later ones. One pure function in `src/shared/visibility/story.ts` gives the hidden sets at a step; the result goes through the rule of 0194, so nothing else decides whether an element is visible. An id that is not in the catalogue is ignored and kept, and Diagnostics lists it.
- **The step being shown is session state.** It is not saved and is not an edit. Stories are content and are saved.
- **The presenter view** is the editor window with its docks and toolbar out of the way, over the same canvas. Entering sets the step to 0 and leaves the view of the canvas where it is; next and previous change the step, and the view stays where the presenter put it. Nothing in the view can be selected, moved or edited. Leaving returns the sets to what was hidden before. The first version has no captions.
- **Writing a story** happens in a panel in the right-hand dock, opened from a play button in the toolbar: a list of steps, like the slide list of a presentation program, and for the selected step one row per set that is shown, hidden or left alone by that step. Selecting a step shows its state on the canvas, so the person sees what the audience will. The panel can add, duplicate, move and delete steps, and make a story from the sets in the order of the catalogue, one step per set, each showing the next set and hiding nothing.
- **Exports draw what is shown** ([0194](0194-visibility-sets-hide-and-show-parts-of-a-diagram.md)), so while a step is on screen they draw that step. An export of a whole story is not part of the first version.
- **Format.** An additive change, a minor version. An older application ignores `stories`; its newer-file warning applies on save ([0118](0118-saved-with-version-marker.md)). `docs/file-format.md` and the schema change together.
- **Writers.** The command line and the extension read and write stories through edit operations with the stale-edit check ([0109](0109-stale-edit-check-for-every-ai-write-path.md)); a story and a set are named by their names. The inspect answer lists the stories and their steps by set name, and the file validator warns about two stories with one name and about an id that no set holds.

## Alternatives considered
- **A snapshot of the shown sets at each step.** Rejected: every step would repeat the whole state, so adding a set or inserting a step means editing every later step, and what a step *does* ("today gives way to proposed") is lost.
- **Operations as an ordered list of `{ op, set }`.** Rejected: it allows the same set twice in a step with an order that matters, which no one needs; two lists with one fixed order say the same thing.
- **A number on each element, shown up to a step.** Rejected for the reason in 0194: it only adds elements.
- **One story per diagram.** Rejected: a second audience would need a second diagram, or a format change later.
- **The view fits what is shown at each step.** Rejected for now: it moves under the presenter's hands and fights a manual zoom. It can be added later as an option without changing the file.
- **Captions on steps.** Left out of the first version; a `caption` field can be added to a step later without breaking older readers.

## Consequences
- Stories refer to sets by id, so renaming a set changes no story. Deleting a set leaves its id in the steps, ignored, so a story keeps working and nothing is rewritten behind the person's back.
- The editor and the presenter drive the same session state as the sets panel (which sets are hidden), so the panel shows what a step did, and the person can toggle a set by hand while editing. The presenter is the one place that locks this.
