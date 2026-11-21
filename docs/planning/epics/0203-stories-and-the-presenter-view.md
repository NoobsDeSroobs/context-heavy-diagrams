# 0203: Stories and the presenter view

## Status
Built on the branch `epic/0203-stories-and-the-presenter-view`. Builds on [0202](0202-visibility-sets.md) (merged).

## Goal
Tell a diagram as a story: first this, then that. "This is what we have today", "this is how it is connected now", "to fix the integration problem we can connect it like this". A story is a sequence of steps over the visibility sets of 0202, stepped through in a presenter view that grows, and shrinks, the diagram one step at a time. Reasons and alternatives: [ADR 0195](../../decisions/0195-stories-are-steps-over-the-visibility-sets.md).

## Decided
- **A story is an ordered list of steps; a step is an ordered list of actions**, each `{ action, set }` (show or hide a set; the list is open to more kinds, decided 2026-11-21). The state at step n is the result of applying steps 1 to n in order. Stepping back or jumping to a step is a replay, and inserting a step does not mean redoing the later ones.
- **Before step 1.** Every set the story names starts hidden, so only the elements in no set (and in sets the story leaves alone) are shown.
- **Several stories in one diagram,** each with a name (decided 2026-11-21).
- **No captions** on steps in the first version (decided 2026-11-21).
- **The camera stays where it is** when a step changes (decided 2026-11-21).
- **Writing a story:** a play-button "Stories" button in the toolbar opens a panel in the right-hand dock, laid out like the slide list of a presentation program, simplified: the steps in order, and for the step picked its actions, one row each, a pair of choices (action, then set); a new step is empty. Picking a step shows its state on the canvas, and its tooltip says which sets are shown after it. Add, duplicate, move (drag or arrows) and delete steps and actions. No "record" button (decided 2026-11-21).
- **The presenter view** takes the window over (toolbar and docks out of the way), starts at step 0, steps with the arrow keys, space, Home, End, and leaves with Esc; nothing can be selected or edited, and no editor shortcut runs. Session state: the step is not saved and is not an edit; leaving puts the hidden sets back as they were.
- **All sets** is a meta target in the set list, above the real sets and apart from them, reserved value `*` in `set` (decided 2026-11-21); a story that uses it starts with every set hidden. The editor previews a step on the canvas only while the panel is open, and **Make steps from the sets** sits at the bottom of the panel.
- **Fade** in the presenter when an element appears or disappears; the editor is immediate.
- **Exports** draw the step on screen (0202).
- **Format.** An additive change, a MINOR bump (0.14.0, already open): `stories` in `schema.ts` and `docs/file-format.md`.

## Open questions
- **Exports of a whole story,** one image per step or a slide per step, is a follow-up and is not part of the first version.
- **Full screen.** The presenter fills the window, not the screen; a real full-screen toggle (F11) may be wanted.
- **More actions** (grow, highlight, emphasise): the state function then has to return more than the hidden sets, and an action that lasts one step needs a rule.
- **Captions.** A text per step shown in the view, additive in the file when wanted.
- **Undo.** Making, renaming and deleting a story and editing steps cannot be undone yet, like the sets themselves.

## Tasks
- [x] ADR: the story and its steps as operations, accumulation from a start state, the presenter view, and the alternatives (a snapshot of the visible sets at each step) ([0195](../../decisions/0195-stories-are-steps-over-the-visibility-sets.md)).
- [x] `schema.ts` and `docs/file-format.md`.
- [x] The state at a step as one pure function in `src/shared/`, with tests for accumulation, hide and show in one step, jumping and going back.
- [x] The presenter view: the controls, the shortcuts, no interaction.
- [x] The step editor.
- [x] The numbered shortcut: **Make steps from the sets**, one step per set in catalogue order.
- [x] CLI, extension and assistant guidance (`add_story`, `rename_story`, `remove_story`, `add_story_step`, `remove_story_step`, `add_story_action`, `remove_story_action`; inspect; validator; skill docs).
- [x] An example diagram with a story (`examples/stories.chd`), and `examples/README.md` ([ADR 0151](../../decisions/0151-every-visible-feature-has-an-example-diagram.md)).
- [x] Changelog under File format and Added.
- [x] The "All sets" meta target (state, editor, assistant operations, validator, docs), the preview only while the panel is open, and **Make steps from the sets** at the bottom.
