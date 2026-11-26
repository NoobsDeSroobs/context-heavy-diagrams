# 0192: A view-only mode

## Status
Not Started. Parked. Logged 2026-11-17, when React Flow's own lock button was hidden from the corner panel.

## Goal
Lock a diagram against edits while everything that is for reading still works: animated edges, highlights, search and isolate, the Ctrl peeks, the legend, the crossings, panning and zooming, following a link. For presenting a diagram, reviewing one, or just not moving something by accident.

## Update 2026-11-21
The presenter view ([ADR 0194](../../../decisions/0194-one-diagram-several-views-visibility-sets-and-stories.md)) covers presenting, but it is the opposite of this: it makes the diagram click-through, so nothing can be selected, opened or followed, and it hides the chrome. Reading and reviewing a diagram, and not moving something by accident, stay for this epic, parked. What the presenter found helps: a node's own `draggable` beats React Flow's global switch, so a lock has to set the per-node switches too (`lockedForPresenting`). What is left is the edit paths that are not canvas gestures: the property fields, paste, undo, label editing and the palette.

## Why the old button was not it
It flipped three React Flow settings (dragging, connecting, selecting) and nothing else. Gestures of ours ignored it, a diagram with nothing selectable cannot show its properties, and it was unrelated to the per-element lock.

## Open questions
- **What counts as an edit.** Dragging, resizing, drawing edges, label editing, paste and delete, the property panel's fields, the palette, drag to add, keyboard nudging, undo. One flag in the canvas that every edit path checks, not a list of exceptions.
- **What stays.** Selecting, so the properties can be read (fields shown but disabled)? Opening notes and links? Changing a highlight or a legend switch (session state, not an edit)?
- **How it shows.** A mark in the corner panel and a banner or a locked badge, so nobody wonders why nothing moves; a View menu item and a shortcut.
- **Session or file.** A session switch to begin with; a flag in the file ("open this read-only") only if the need shows.
- **Relation to the per-element lock** (a `locked` element stays put and is still selectable) and to tag locks: separate, and the mode wins.
- **The assistant tools** write files and are not affected; the mode is about the canvas.

## Tasks
- [ ] Design pass on the questions above; an ADR.
- [ ] One edit gate in the canvas, every edit path through it; a test that lists the paths.
- [ ] The switch, its mark and the disabled fields.
