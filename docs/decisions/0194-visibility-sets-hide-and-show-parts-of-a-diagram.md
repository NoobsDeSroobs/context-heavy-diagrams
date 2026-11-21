# 0194: Visibility sets: hide and show parts of a diagram

## Status
Accepted (2026-11-21), and kept up to date as the design is tried.
Builds on: [0025](0025-tagging-and-overlay-visualization.md) (a catalogue persists, a session pointer is decided per case), [0118](0118-saved-with-version-marker.md) (what an older application does with a field it does not know), [0109](0109-stale-edit-check-for-every-ai-write-path.md).
Supersedes: none
Superseded by: none

## Context
One diagram often holds more than one picture: how things are today and how they could be; the entities, and then how they are connected. A person wants to show one at a time, and to be able to bring the other back. Nothing in the app hides part of a diagram. Isolate only dims what is not found; tags describe the architecture (the security matrix, diffs and required tags read them) and are not presentation; an edge direction set ([0081](0081-flippable-edge-direction-sets.md)) swaps arrows and deliberately has no inclusion or exclusion.

## Decision
- **A diagram has a catalogue of visibility sets:** a new optional diagram-level field `visibilitySets`, a list of `{ id, name }`, left out of the file when it is empty. The id is opaque, unique in the diagram and never reused; the name is free text and can change without touching the elements. The order of the list is the order shown to the person.
- **A node or an edge lists the sets it belongs to** in a new optional element-level field `visibilitySetIds`, a list of ids, left out of the file when it is empty, and written sorted and without repeats so the file does not change when the same sets are joined in another order. An element can be in several sets.
- **The rule is one function, with three cases.** An element in no set is always shown. Otherwise it is shown when any of its sets is shown (the union, so a service in both "today" and "proposed" survives hiding "today"). An id that is not in the catalogue is ignored, so a deleted set cannot hide anything.
- **Nothing is inferred.** An edge is shown or hidden by its own sets, not by its ends; a child of a container by its own sets, not by its container. A visible edge next to a hidden end, or a child on an empty canvas, is for the author to fix. This is what lets a story show the entities first and the connections after.
- **Which sets are shown is session state.** Every set is shown when a diagram is opened; toggling is not an edit, does not mark the file as changed, and is not saved. The catalogue and the membership are content and are saved.
- **To the editor a hidden element is not there.** It is not drawn, and it cannot be selected in any way: not by a click, a drag select or select all. Copy, delete, align, search, isolate, the highlights and the crossings do not see it. An element that is selected and then hidden, or put in a hidden set, leaves the selection. Its position is still kept: when an element moves, an edge attached to it moves with it, hidden or not, so everything is in place when its set is shown again. The file always holds every element; hiding never writes anything.
- **Exports draw what is shown:** SVG, PNG and draw.io leave out what is hidden, so a file is what the person sees. The `.chd` itself always holds every element, and the command-line export draws everything, since it has no session to read the shown sets from.
- **A change of membership is a change in a review,** like any other change that carries meaning ([0153](0153-a-look-that-carries-meaning-is-a-change-in-a-review.md)).
- **Format.** An additive change, a minor version. An older application shows everything, and its newer-file warning applies on save ([0118](0118-saved-with-version-marker.md)). `docs/file-format.md` and the schema change together.
- **Writers.** The command line and the extension read and write the catalogue and the membership through their edit operations, with the stale-edit check ([0109](0109-stale-edit-check-for-every-ai-write-path.md)); the operation names are settled when they are built.
- **The panel** opens from a button in the bottom left corner, next to the highlights, as a floating panel. Each set has a checkbox (shown), a name edited in place, the number of elements in it, and buttons to put the selected elements in it, take them out, and delete the set (after a confirmation when it has elements). A new set is added by name at the bottom. This is a first version to be tried; this record is amended when it is refined.

## Alternatives considered
- **Tags as the sets.** Rejected: a tag is data about the architecture, with its own rules (required values, cascade, the security matrix, review); using it for presentation would mix the two and show up in places that have nothing to do with how a diagram is presented.
- **A number on each element, shown up to a step.** Rejected: it only ever adds elements, so "today" cannot give way to "proposed".
- **One set per element** (an exclusive layer). Rejected: the elements two pictures share would have to be copied or left out of one.
- **Shown only when all of its sets are shown.** Rejected: a shared element would vanish when either picture is hidden.
- **Hiding by what an element is attached to or sits in.** Rejected for the story above, and because it makes the rule depend on the structure of the diagram.
- **Storing which sets are shown, as the active edge direction set is.** Rejected: a file would open with parts missing for someone who did not hide them, and what is shown is something a presentation drives, not part of the diagram.
- **Dimming instead of hiding.** Rejected for now: a dimmed element can still be selected and moved by mistake. A dimmed look can be added later without changing the rule.

## Consequences
- Every place in the canvas that lists elements has to ask the one visibility function, so that hidden elements are left out of selection, copy, align, search and the rest. This is a standing cost: a new feature that enumerates elements must do the same, and a test lists the paths that must.
- A person can hide something and forget; the panel has to show that a set is hidden.
- Deleting a set takes its id off every element. An undo brings the membership back but not the set, and an id with no set in the catalogue is ignored, so nothing is hidden by it.
- The file stays a plain list of nodes and edges. Nothing about it depends on the sets, so an older application, a script and a review read it as before.
- A later feature that steps through sets to tell a story needs only the same function and a way to set which sets are shown.
