# 0160: Save As copies into a folder named after the new diagram

## Status
Accepted (2026-11-08). Replaces the "Save As writes only the notes that were edited" limitation of [ADR 0092](0092-unified-multi-file-save-and-change-detection.md).

## Context
A diagram refers to other files by paths relative to its own folder: notes, reference images, custom icons and linked diagrams. Save As used to write the diagram and the notes that had unsaved edits to the new place, and left every other reference as it was. In another folder those paths pointed at nothing, or, for notes saved earlier, at the files of the original diagram, so an edit to one diagram's note changed the other's.

A person who saves a diagram under a new name wants one of two things: a variant of the whole diagram, or its layout as a starting point for something else. The app cannot tell which, and a relative path cannot be kept across drives or network shares, so a reference that is not carried over cannot be repaired by rewriting it.

## Decision
1. **Save As is a dialog with a path field and toggles.** The path is only ever set by the operating system's save picker (Browse), which checks the folder and asks before replacing a file. The toggles are **Notes**, **Images and custom icons** and **Linked diagrams, recursively, with the same settings**; notes and images start ticked, linked diagrams unticked. Each shows how many files it covers, and the dialog says that anything not ticked is removed from the copy and that the original is not changed.
2. **Every reference is copied or removed, never left behind.** A reference whose toggle is off, whose file is missing, or whose path reaches outside the old diagram's folder is removed from the copy and listed in the dialog ([ADR 0115](0115-paths-stored-in-diagrams-are-untrusted.md) forbids copying from outside the folder). Nothing is rewritten to point back at the original.
3. **Layout.** The new diagram `B.chd` keeps its notes and images in `B/`. Everything else keeps its place relative to the old diagram's folder, one level down: `child.chd` becomes `B/child.chd`, `sub/x.chd` becomes `B/sub/x.chd`, each with its own notes and images. The old diagram's own folder `A/` maps onto `B/`, so a copy of a copy does not nest deeper. Every stored path in every copied diagram is recomputed for where that diagram ends up; a child's link back to the old diagram becomes a link to the new one.
4. **Linked diagrams are all or none.** With the toggle on, every diagram reachable through links is copied once (a cycle or a diagram linked twice is not repeated), with the same note and image settings. There is no one-layer option: it would leave copies whose own links are cut at a depth chosen by the code.
5. **Two names must be free:** `B.chd` and the folder `B/` (the folder only when something is copied into it). Because every copied file goes into a new folder, nothing else can collide, with one exception: two sources that would map onto one destination (the old diagram's `assets/` and a top-level `assets/`, for instance) refuse the copy and name both.
6. **Nothing is replaced.** The executor checks every destination before writing the first file, and the diagram is written last, so the copy never points at a file that is not there.
7. **A diagram that has never been saved has nothing to copy** and keeps the plain picker.

The plan is made in the main process from the old folder and the window's current references, and is made again when the person confirms; the dialog's counts and the save come from the same plan. A schema test reads the `schema.ts` files and fails when a field that looks like a stored path is not one the plan handles, so a new kind of reference cannot be forgotten.

## Alternatives considered
- **Keep relative links working by rewriting them** (`../old/child.chd`). Impossible across drives and shares, escapes the folder the containment rule keeps references inside, and ties the copy to the original's place on disk. Nobody wants it: a copy is either independent or a mistake.
- **Copy everything always, or nothing.** Cannot serve both a variant and a template.
- **Ask after the picker, or write the path by hand.** A typed path would need the picker's checks written again, and the options depend on the destination only through the two names above.
- **Copy one layer of linked diagrams.** See decision 4.
- **Keep each child beside the new diagram** (flat, as it was). Collides with existing files in the destination folder and would need the same checks for every file.

## Consequences
- Children that sat beside the diagram now sit inside `B/`: the copy has a different shape from the original.
- Unsaved edits to a note are not in the copy when notes are unticked, and open reference windows are closed.
- A custom icon is an image for this purpose. The few diagrams that refer to files outside their folder lose those references in the copy, and the dialog lists them.
- The rule is cross-platform: stored paths are normalised to `/`, and a path with a drive or stream (`C:x`) is refused on every system.
- A copy can be large: a hub diagram pulls in everything it reaches. The dialog shows the totals before anything is written.
