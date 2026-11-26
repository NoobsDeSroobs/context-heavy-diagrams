# 0194: One diagram, several views: visibility sets hide parts of it and a story tells them in order

## Status
Accepted (2026-11-21), kept up to date as the design is tried. Merges 0194 (visibility sets) and 0195 (stories) into one decision, reworded 2026-11-26. It builds on [0025](0025-highlights-recolour-by-tag-value-the-catalogue-is-saved-and-what-is-on-is-not.md) (a catalogue persists, a session pointer is decided per case), [0118](0118-saved-with-version-marker.md) and [0109](0109-stale-edit-check-for-every-ai-write-path.md).

## Context
One diagram often holds more than one view: how things are today and how they could be; the entities, and then how they are connected. A person wants to show one at a time, bring the other back, and tell them in an order: "this is what we have today", then "this is how it is connected", then "this is how we could fix it". Nothing in the app hid part of a diagram. Isolate only dims; tags describe the architecture and are not presentation; an edge direction set swaps arrows and deliberately has no inclusion or exclusion.

## Decision
**A diagram can hold several views as visibility sets, and a story is an ordered list of steps over them.** What is shown is session state; the sets and the story are content.

**Visibility sets**
- **A catalogue and a membership.** A diagram-level `visibilitySets`, a list of `{ id, name }`, and an element-level `visibilitySetIds` on a node or edge, both left out when empty. The id is opaque and never shown, so a rename changes nothing that refers to it; the name is free text, unique ignoring case in the panel. An element can be in several sets.
- **One rule, three cases.** An element in no set is always shown. Otherwise it is shown when any of its sets is shown, so a service in both "today" and "proposed" survives hiding "today". An id that is not in the catalogue is ignored, so a deleted set cannot hide anything.
- **Nothing is inferred.** An edge is shown or hidden by its own sets and not by its ends, a child by its own sets and not by its container. A visible edge next to a hidden end is for the author to fix, and it is what lets a story show the entities first and the connections after.
- **Which sets are shown is not saved.** Every set is shown when a diagram opens; toggling is not an edit and does not mark the file as changed.
- **To the editor a hidden element is not there** and the file still holds it. It is not drawn and cannot be selected in any way; copy, delete, align, search, isolate, highlights and crossings do not see it. Its position is kept, and an edge attached to it moves with it, so everything is in place when its set is shown again.
- **Exports draw what is shown,** so while a step is on screen they draw that step; the SVG and draw.io exports also drop an edge with an end left out and re-parent an element whose container is left out. The command-line export draws everything, since it has no session to read the shown sets from. A change of membership is a change in a review ([0132](0132-reviewing-a-change-one-engine-a-read-only-window-and-the-same-answer-on-the-command-line.md)).

**Stories**
- **A story is `{ id, name, steps }`, optional `start`.** A step is an ordered list of actions `{ action, set }`; the actions are `show` and `hide`, naming a set by id, run in order so the last wins. `set` can be the reserved `*`, "all sets", meaning every set the catalogue holds when the step runs. The shape is open: a later action is a new `action` value, and a reader ignores one it does not know and keeps its fields. A diagram can hold several stories, one per audience.
- **Steps accumulate from a state where every set is hidden.** Step 0 is that state plus the story's `start` actions, so a story rarely needs to hide anything. The state depends only on the step number, so going back or jumping is a replay from step 0, and one pure function gives the hidden sets at a step and goes through the rule above. Elements in no set stay visible even at step 0.
- **The step being shown is session state,** and the editor's own changes (picking a step, ticking a set) are immediate.
- **The presenter view is the editor window with its docks out of the way,** over the same canvas. Nothing in it can be selected, moved or edited. Changing between steps fades elements in and out unless the system asks for reduced motion. The step count is always shown, small and faint; the bar with the step buttons appears when the mouse moves.
- **Stories are written in a panel in the right-hand dock** as a list of steps and, for the selected step, its actions. Selecting a step previews it on the canvas, but only while the panel is open.
- **Writers.** The command line and the extension read and write both through edit operations with the stale-edit check ([0109](0109-stale-edit-check-for-every-ai-write-path.md)), naming a set or story by its name, and the validator warns about duplicate names and ids that no set holds. The format change is additive, a minor version; an older application shows everything and ignores `stories`, and its newer-file warning applies on save ([0118](0118-saved-with-version-marker.md)).

## Alternatives considered
- **Tags as the sets.** A tag is data about the architecture, with its own rules (required values, cascade, the security matrix, review); using it for presentation mixes the two.
- **A number on each element, shown up to a step.** It only ever adds elements, so "today" cannot give way to "proposed".
- **One set per element, or shown only when all of its sets are shown.** The elements two views share would be copied, or would vanish when either view is hidden.
- **Hiding by what an element is attached to or sits in,** or **dimming instead of hiding.** The first makes the rule depend on structure; a dimmed element can still be moved by mistake.
- **Storing which sets are shown.** A file would open with parts missing for someone who did not hide them.
- **A snapshot of the shown sets at each step,** or **a step as `show` and `hide` lists.** Both repeat state or need a new list per action, and lose what a step does.
- **One story per diagram,** or **the view fitting each step.** The first would need a second diagram for a second audience; the second moves under the presenter's hands.

## Consequences
- Every place that lists elements must ask the one visibility function, a standing cost for a new feature, and a test lists the paths that must.
- A person can hide something and forget, so the panel has to show that a set is hidden.
- Deleting a set takes its id off every element and leaves it in steps, ignored; making, renaming and deleting a set cannot be undone yet, only membership can.
- The file stays a plain list of nodes and edges, so an older application, a script and a review read it as before.
- A later action that is not about visibility needs the state function to return more than the hidden sets, decided when the first one is added.
