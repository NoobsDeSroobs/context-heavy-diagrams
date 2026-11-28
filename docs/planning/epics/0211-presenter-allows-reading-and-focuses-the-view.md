# 0211: The presenter allows reading, and a story can focus the view

## Status
Not Started. Logged 2026-11-27. Independent of the examples revamp (0193), which carries on through its steps 4 to 6 first; this is built with whatever else those steps find missing, before the diagrams are made. The tutorial there needs both parts.

## Goal
Make the presenter view a read-only view in which reading still works, and let a story move the view to what a step is about, so a guided file can show its areas one after another.

## What is wrong today
Found while planning the tutorial for the examples revamp.
- **Hover does nothing in the presenter.** `stories.css` sets `pointer-events: none !important` on every node, edge, label and handle while presenting, so that a drag pans and nothing is picked, opened or hovered. The peek card (Ctrl or Cmd and hover), and the other Ctrl-hover readings on an edge (the containers a crossing goes between, its animation) never get a pointer event. The global Animate edges switch does work. Hovering only reads, so it belongs in a view that only shows.
- **A step cannot move the view.** The stories code holds no camera: showing a set that lies outside the screen leaves the person looking at empty canvas.

## Part 1: let the reading through
- Hover reaches nodes and edges in the presenter: the peek card, the Ctrl-hover on an edge, the edge's hover animation. Clicks, drags, selection, double-click, the context menu, reconnecting, deleting and following a link stay off, as they are today (following a link would leave the presenter, so it is not a reading).
- A drag on the canvas, or over a node, still pans.
- The presenter's rule that the bar shows only when the mouse moves, and the cursor is hidden when idle, keeps working; the cursor must reappear for a hover to make sense.
- Find out how much of the CSS rule is still needed, given the presenter already turns off draggable, selectable, connectable, deletable and focusable on every element.

## Part 2: a story action that focuses the view
A new story action, `focus`, with a visibility set or all. It moves and scales the view so the elements of the set that are visible at that point in the step fill it, with some room around them; with all, everything visible. As today the state at a step is what its actions, in order, leave, so the frame at any step is the last `focus` at or before it: stepping back restores the earlier frame, and a `focus` in the start state sets the opening frame.
- **The move is a glide** over a set time (a constant next to the fade's), and happens with the step's fade. With the system's reduced-motion setting, or the person's own, it jumps.
- **Limits:** the view's own minimum and maximum zoom apply; whether a small set also needs its own limit is decided when it has been seen, with the room around the set (a padding) the first thing to tune; see the notes for how an author sets it.
- **File format:** an additive new action; a reader that does not know it ignores it and keeps its fields (the rule already in `schema.ts`), so older versions still open the file. Update `docs/file-format.md`.
- **Surfaces:** the schema and its tests; the story state and the presenter; the Stories panel (a picker for the action, and the editor's preview of a step); the edit operations `add_story_action` and its help text; the extension and CLI; the skill files and the field reference; an example (the tutorial `welcome.chd` of the examples revamp, which replaces `examples/stories.chd`; [ADR 0151](../../decisions/0151-every-visible-feature-has-an-example-diagram.md)); the changelog, as a feature and as an additive file-format change.

## Tasks
- [ ] Part 1: let hover through in the presenter; test that the peek card shows on a node and an edge, and that click, drag, select and link-following still do nothing.
- [ ] Part 2: schema and state, the glide, the panel, the edit operations and help, the extension and CLI, the skill and file-format spec, tests.
- [ ] Extend the stories example to use `focus`, and note both parts in the changelog.
- [ ] Then go on with 0193 step 7, whose tutorial needs both.

## Notes
- **When the elements of a set are not the right frame**, three ways were weighed, decided when this is built and the examples show what they need. The maintainer wants both padding and a "use the current window" button for the rectangle if the need arises. An invisible container in the set is out: a container holds things and is not a camera.
  - **An optional padding on `focus`,** in canvas pixels: the first choice, since it is one number on an action that already exists. It cannot add a region on one side only.
  - **A rectangle** (four numbers, x, y, width and height, in canvas coordinates) as the target instead of a set: full control. The editor draws the rectangle while its step or action is selected (never in the presenter or an export), and a "use the current view" button fills it from what the author sees, so nobody types numbers. It does not follow the elements if they move later, and an assistant has to compute it.
  - **A grow or shrink action** relative to the current frame: adds a "current frame" to the vocabulary for what padding on the focus already does; not planned.
- Whether the editor's preview of a step (not the presenter) should glide as well is open; the presenter is the first need.
- Who may promote anything to an ADR is the maintainer; nothing here needs one unless the presenter's rule changes from "only shows" to something else, which it does not: reading is still showing.
