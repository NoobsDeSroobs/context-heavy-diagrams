# 0202: Visibility sets

## Status
In Progress: design decided 2026-11-20, nothing built. Logged 2026-11-20. The stories and the presenter view that use it are [0203](0203-stories-and-the-presenter-view.md).

## Goal
Let a person mark nodes and edges as members of named **visibility sets**, and show or hide each set on demand in the ordinary diagram, like the layers of a drawing tool. The use: one diagram that holds how things are today and how they could be, shown one at a time. It is useful without any story.

## Decided
- **A new field, not tags.** Tags describe the architecture (the security matrix, diffs and required tags read them); a visibility set is presentation. The diagram has a catalogue of sets (an id and a name each), and every node and edge may list the sets it belongs to. An element can be in several sets. The fields and the rule are in [ADR 0194](../../decisions/0194-visibility-sets-hide-and-show-parts-of-a-diagram.md).
- **The rule.** An element in no set is always visible. Otherwise it is visible when any of its sets is shown, so a service in both "today" and "proposed" survives hiding "today". Nothing is inferred: an edge is shown or hidden by its own sets alone, not by its ends, and a child by its own sets, not by its container. An edge left hanging, or a child on an empty canvas, is for the author to fix.
- **Hidden elements still exist, and the editor treats them as not there.** They stay in the file and the diagram and are not drawn. A person cannot select them in any way: not by clicking, not by drag select, not by select all. An edge whose end is moved still follows it while hidden, so it is in the right place when its set is shown again (or is updated at the latest when it is shown).
- **The panel** sits in the bottom left corner next to the highlights and the other panels of that corner. How sets are added, renamed and put onto elements is designed after the first version has been tried; the first version only needs enough to try it.
- **What lives where.** The sets and who is in them are authored content and go in the `.chd` file. Which sets are shown right now is session state, so toggling is not an edit.
- **Exports** draw what is shown at the moment, unless that turns out to be costly or to cause trouble; the design pass checks.
- **Format.** An additive change to `schema.ts`, a MINOR bump; `docs/file-format.md` changes with it. An older app ignores the fields and shows everything.

## Open questions
- **The panel's contents.** A list of the sets with an eye toggle each, where one is added, renamed and deleted; how a new element made while a set is hidden gets its sets (probably none). To be settled by trying a first version.
- **Putting elements in a set.** "Add the selection to a set" and "remove from", and a field in the properties panel; a badge on an element that is in a set, or a count on the set. Likewise after trying it.
- **Hidden and the other commands.** Copy, delete and align skip hidden elements as selection does; what undo does about a hide (it is not an edit, so probably nothing).
- **The other views.** Search, isolate, highlights, the legend and the crossings do not see hidden elements.
- **Review and diff.** Adding an element to a set is a change in a review (compare [ADR 0153](../../decisions/0153-a-look-that-carries-meaning-is-a-change-in-a-review.md)).
- **The assistants.** The CLI and the extension can list sets, put elements in them and read membership, with the stale-edit check ([ADR 0109](../../decisions/0109-stale-edit-check-for-every-ai-write-path.md)).

## Tasks
- [x] ADR 0194: the field and the catalogue, the visibility rule, session state for what is shown, and the alternatives (kept up to date as the design is tried)
- [x] `schema.ts`, `serialize.ts`, the review and the changes-since-save lists, `docs/file-format.md`, and tests (shared code only).
- [x] Carried through the app: `diagramConversion.ts` in both directions, the catalogue as canvas state, and the save, autosave, close summary, changes list, checks panel and image export that build the file; copy and paste keep the ids; a round-trip test with sets in the fixture. There is no way yet to make a set in the app, so a file with sets is made by hand or by the command line.
- [ ] The visibility rule as one pure function in `src/shared/`, with tests for several sets, none, edges and containers.
- [ ] Hiding in the canvas: not drawn, not interactable, skipped by selection and the other views.
- [ ] The sets panel and the commands to put elements in and out of a set.
- [ ] Exports draw what is shown.
- [ ] CLI, extension and assistant guidance.
- [ ] An example with a diagram that shows today and a target as two sets, and `examples/README.md` ([ADR 0151](../../decisions/0151-every-visible-feature-has-an-example-diagram.md)).
- [ ] Changelog under File format and Added.
