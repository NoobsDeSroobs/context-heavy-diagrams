# Changelog

What changed for people using the tool, one entry per minor or major release. The reasons are in [docs/decisions/](docs/decisions/); the full history is in `git log`.

## 0.15.0 (unreleased)

### Added

- **New edges follow a line of the diagram's legend.** The edge-style button at the top now lists the diagram's own legend lines first, so a new edge is "Data flow" from the moment it is drawn, not "a dashed arrow". Pick a line to draw new edges with it (it is ticked; pick it again to stop), or a preset below for every diagram as before. The button shows the line in use. Edges already drawn keep their own style, and a direction set's own style still wins ([ADR 0196](docs/decisions/0196-new-edges-follow-a-line-of-the-diagrams-legend.md)). `edit_diagram` and `chd edit` have `set_new_edge_line`, and `connect` without a style uses the line.

- **A legend line has a thickness.** Copying an edge into the legend, and drawing new edges with a legend line, now keep how thick it is. `set_legend_entry` and `add_legend_entry` take `strokeWidth` ([ADR 0197](docs/decisions/0197-pointed-arrowheads-keep-their-tip-and-lines-carry-a-thickness.md)).
- **Parallel paths have their own symbols.** *Run in parallel* opens paths that run side by side, *Wait for all* goes on when every path has arrived, and *Wait for first* goes on with the first. They are plum, apart from the amber decisions, and a decision is closed by a decision symbol. `chd validate` and the assistant tools warn when the ways of a decision meet at a join that waits for all of them, which would never finish. [Why](docs/decisions/0198-parallel-paths-are-closed-by-a-wait-and-decisions-by-a-decision.md).
- **The edge-style picker shows the lines as they look.** Each row, and the button, is drawn with the line's colour, thickness, dashes and ends instead of a grey bar.

### Changed

- **An assistant no longer chooses ids.** The tool makes every id; the add operations (`add_entity`, `connect`, `add_legend_entry` and the rest) take `"as": "$name"` instead of `id`, a handle that later operations of the same call can use and that is never saved. An `id` on an add operation is refused. [Why](docs/decisions/0199-the-tool-makes-every-id-and-an-operation-names-what-it-makes-with-a-handle.md).
- **A note's file name ends in six characters, not a whole UUID.** A note is now `<label>-6789ab.md`, and an assistant writing a note gets exactly the name the editor would give it (`set_note` no longer takes a `name`, and the type prefix of an id never reaches the file name). Notes that already exist are renamed the next time their diagram is saved. [Why](docs/decisions/0060-detail-file-naming-convention.md).
- **Pointed arrowheads keep their tip.** The line now stops just short of a filled arrow or diamond, so the tip is no longer blunted by the end of a thick line. Drawn the same way in the SVG and image exports ([ADR 0197](docs/decisions/0197-pointed-arrowheads-keep-their-tip-and-lines-carry-a-thickness.md)).

### Fixed

- **The standard edge respects the routing type.** A legend line can now carry a routing type (straight, step, smoothstep, curved): picking a line from an edge copies it, the legend's Routing choice sets it, and new edges drawn with that line are laid out that way. A line without one, or a preset, no longer loses the routing set in the preferences ([ADR 0196](docs/decisions/0196-new-edges-follow-a-line-of-the-diagrams-legend.md)).
- **Edges no longer drift away from their elements when you zoom.** The gap grew with every zoom until the element left the window and came back; the connection points are now measured again once the zoom rests ([ADR 0129](docs/decisions/0129-connection-handles-keep-a-minimum-screen-size.md)).
- **A double-click on a behaviour or an edge opens its label for writing**, empty or not. Before, a decision or a parallel shape with no label had nothing to click.
- **Dragging an edge from an unselected shape no longer wires the selected one too.** After moving A, dragging from B onto A gave an edge from A to A as well. Only a drag that starts from a selected shape now wires the whole selection, and a shape is never wired to itself ([ADR 0059](docs/decisions/0059-multi-connection-line.md)).

### File format

- A legend entry of kind `line` may have `forNewEdges: true`, `strokeWidth` and `routingStyle`, documented in [docs/file-format.md](docs/file-format.md). Left out when not set. An older app ignores them.

## 0.14.0 (2026-11-21)

### Added

- **Visibility sets: show or hide parts of a diagram.** Make named sets in the new panel in the bottom left corner (the eye button, before the highlights), put the selected elements in a set with **Add selected**, and tick or untick a set to show or hide everything in it. One diagram can then hold how things are today and how they could be, shown one at a time. An element in no set is always shown, and one in several is shown while any of them is. A hidden element is out of the way: it is not drawn, cannot be selected in any way and is left out of search. An edge goes by its own sets, so put an edge in too when it belongs to a picture. A caret beside each set lists what is in it, with a way to select an element, go to it, or take it out. Set names are unique, ignoring case. Which sets are hidden is not saved: a diagram opens with everything shown. SVG, PNG and draw.io exports draw what is shown; the command-line export draws everything ([ADR 0194](docs/decisions/0194-visibility-sets-hide-and-show-parts-of-a-diagram.md)).
- **Stories: tell a diagram one step at a time.** A story is an ordered list of steps over the visibility sets: *this is what we have today*, then *this is how it is connected*, then *to fix the problem we can connect it like this*. Open the **Stories** button in the toolbar (or View, Stories) to write one in the right-hand panel, laid out like a slide list. A new step has no actions; add them one at a time, each a pair of choices, the action (Show, Hide) and then the set, and reorder them by dragging or with the arrows. A step's tooltip says which sets are shown after it. Picking a step shows its state on the canvas, but only while the panel is open: closing it puts everything back. **All sets** is a choice above the real sets in the set list, apart from them: *Hide All sets* then *Show Today* leaves only Today, whatever other sets the diagram has or gets. Actions run in order on top of what the steps before it did; before the first step, every set is hidden, so a story only needs Show actions; elements in no set are always shown, and the panel says how many there are. The first row of the list, **Start state**, has actions of its own that run when the presenter opens: add a set to show from the start, or Show All sets to start with everything. In the presenter a small step count (2/5) sits in the bottom right and the controls appear only when the mouse moves. The list of actions is open to more kinds later. **Make steps from the sets** gives the simplest story, one step per set. **Present** (F5, or View, Present story) takes the window over, fading elements in and out: right arrow or space for the next step, left arrow to go back, Home and End, Esc to leave, and nothing can be selected or edited. A diagram can hold several stories. Exports draw the step on screen. Which step is shown is not saved ([ADR 0195](docs/decisions/0195-stories-are-steps-over-the-visibility-sets.md)). Open `examples/stories.chd` to try it.
- **Assistants can write stories.** `edit_diagram` and `chd edit` have `add_story`, `rename_story`, `remove_story`, `add_story_step`, `remove_story_step`, `add_story_action` and `remove_story_action` (step 0 is the start state), naming a story and its sets by name (`all: true` for all sets); `inspect_diagram` lists the stories, and the validator warns about two stories with one name, an action it does not know and set ids that no set holds.
- **Remove a highlight group.** The header of a group in the Highlights panel has a cross that removes every highlight of its key, after a confirmation. Removing the rows one by one never worked, since a group puts its rows back while their values are in use. The group stays gone until you add it again.
- **Assistants can use visibility sets.** `edit_diagram` and `chd edit` have `add_visibility_set`, `rename_visibility_set`, `remove_visibility_set`, `add_to_visibility_set` and `remove_from_visibility_set`; a set is named by its name. `inspect_diagram` lists the sets and names the sets of each element, and `validate_diagram` and the checks warn about two sets with one name and about an id with no set.
- **Diagnostics lists ids that belong to no set.** An element can name a set the diagram does not hold (an undo, or a file made by another tool). It is ignored and kept, and Diagnostics says so.

### File format

- A new optional top-level `visibilitySets` (the catalogue: `id`, `name`) and an optional `visibilitySetIds` on each node and edge, documented in [docs/file-format.md](docs/file-format.md). Both are left out when empty. An older app shows everything and warns on save, like for any newer field.
- A new optional top-level `stories` (each `id`, `name`, an optional `start` and `steps`, a step being an ordered list of `actions`, each `{ action, set }` with `show` and `hide` known; `set` is `"*"` for all sets), documented in [docs/file-format.md](docs/file-format.md). Left out when empty. An older app ignores it and warns on save.

## 0.13.0 (2026-11-20)

### Added

- **Behaviour symbols of our own.** Each kind has one mark and one meaning: a robot for the automatic step, a person for the human step, stacked layers for the sub-flow, the repeat symbol for the repeated step, a sideways fork for the decision, two overlapping rings for the inclusive choice, two bars for the parallel split or join, a play triangle for a start, a clock for a timer and an envelope for a message. [Why](docs/decisions/0193-behaviour-symbols-one-colour-per-family-and-an-end-that-says-how-it-ended.md).
- **An event can begin a flow or sit in one.** **Position** (Properties) on an event, timer, message or human action: *Starts a flow* draws one ring, *In the flow* (the default, as before) two. Assistants set it with `set_behaviour_position`.
- **An end says how it finished and how far it reaches.** **Outcome** (Properties): success, success with warnings, failed or aborted, told by a tick, a tick with an exclamation mark, a cross or a stop square. **Reach**: this path only, or the whole flow, drawn as a solid disc, which stops every path still running at once. Assistants set both with `add_behaviour` and the new `set_behaviour_ending`. The legend has a row for each way an end finishes that the diagram uses. See `examples/process-flow-order-to-delivery.chd`.

### Changed

- **The first-start question about the icon pack is a banner across the top of the window,** not a box over it ([ADR 0192](docs/decisions/0192-the-first-start-question-is-a-banner-at-the-top.md)). Answer it, or leave it, and the app is usable either way; closing the window without answering asks again on the next start.
- **New colours for behaviour: one per family** (teal steps, amber choices, indigo blue events), so the families differ in lightness and without colour. There is no red or green any more. Diagrams that did not colour a behaviour themselves take the new colours; one you coloured is unchanged.
- **The user step is now the human step** (`step-human`, "Human step"). A person's steps are often part of the system, not its users.

### File format

- **Breaking for older apps:** the id `step-user` is now `step-human`. This version reads both and writes only the new one, so the first save rewrites every user step in a file; an older app or command line draws a human step as a plain step.
- New optional fields `data.outcome` and `data.reach` on an end, `data.flowPosition` on an event, and a new kind `event-human`, documented in [docs/file-format.md](docs/file-format.md). An older app draws an end with an outcome as a tick, so a failure looks like a success there.

## 0.12.0 (2026-11-18)

### Added

- **Icon packs.** Install a set of icons (a cloud vendor's, your company's) once per machine with **View → Icon packs**, then pick from it in any diagram. A pack is a folder of SVG files; the app ships none of its own besides Tabler. The picker has a section per pack and subset, with search. Icons follow the text colour in both themes, and colours a pack fixes are kept. A diagram that uses a pack this machine lacks says which one, and what to do about it, in the Diagnostics panel. The SVG, PNG and draw.io exports draw them. The format of a pack is in [docs/icon-packs.md](docs/icon-packs.md). ([ADR 0188](docs/decisions/0188-icons-come-from-installed-packs-drawn-as-cleaned-inline-svg.md))
- **Tabler is an installable pack.** The app asks on the first start whether to install it, and the manager can do it later. Existing diagrams that use the built-in icons are unchanged.
- **An icon added one at a time goes into the pack `Misc icons`.** Adding an icon from the picker, the legend or when relinking a missing one no longer copies it into the diagram's `assets` folder; it is kept once per machine. Existing diagrams with icons in `assets` still show them.

### File format

- A new icon source, `"installed"` (`pack` and `path`), and a top-level `iconPacks` list the application writes on save, documented in [docs/file-format.md](docs/file-format.md). A version without them draws no icon there.

### Changed

- **Edge points move with the elements.** When both ends of an edge move by the same amount, as when a container is dragged, a selection is moved, nudged or aligned, or an assistant moves a container, the edge's bend points move too, so a loop drawn round an element stays round it. An edge with only one end moved keeps its points, unless Ctrl (Cmd) is held as the drag starts: then the points nearer the dragged element than the other end come along. Nothing in the file changes. ([ADR 0189](docs/decisions/0189-edge-points-move-with-elements-that-move-together.md), [ADR 0190](docs/decisions/0190-ctrl-drag-takes-the-nearest-points-along.md))
- **Right-angled edges: every segment can be dragged, and no more spikes.** A step or smooth step edge now has a handle on each straight segment, including the ones next to its two elements. Drag the line of a straight edge and it leaves each element by a short stub and runs along where you drag it, so a connection between two facing elements goes round both in one drag. A single point no longer makes the route go up and straight back down; the edge leaves and arrives by the side it is attached to. A point added with **Add point here** now lies on the line, and right-clicking close to a point offers **Remove point**. Right-click an edge for **Reset route**, which removes its points and the label's slide along it. Nothing in the file changes; an edge whose route used to run back into its own element is drawn differently. ([ADR 0191](docs/decisions/0191-right-angled-edges-leave-and-arrive-by-their-side.md))
- The command-line export (`chd export`) draws the Tabler icons but leaves out icons from other installed packs, with a note.

## 0.11.1 (2026-11-17)

### Fixed

- **A connection point that was drawn but could not be connected, and edges lost when points were removed.** Raising the number of points on a side of a diagram that was opened again could give the new point the id of one it already had, so one of the two could not be used, and the edge went to the other. Lowering the number to one moved the edges of the point that was removed next to a point that was removed too, and they were lost. A new point now has an id nobody else on the element has, and every edge goes to a point that is left. A diagram already saved with two points of one id keeps them.

## 0.11.0 (2026-11-17)

### Added

- **Edges that cross a container can be marked.** **View → Display → Mark crossings** puts a gate, a short bar along the border, where each edge goes through the border of a container, one for every border it crosses (so an edge out of a group in a lane into another lane has three). Holding Ctrl (Cmd) over such an edge shows which containers it goes between. It is for this session only and off by default, and the SVG export draws the gates when it is on. ([ADR 0185](docs/decisions/0185-edges-that-cross-a-container-are-marked-with-a-gate.md))
- **The label of a container can go on any side.** Top (as before), left, right or bottom; the top of the text points at that side, so a label on the left reads from the bottom up and one on the right from the top down (the bottom stays upright), as on a swim lane. The container's text alignment lines it up along the side. Set it from the property panel. ([ADR 0184](docs/decisions/0184-the-label-of-a-container-goes-on-any-side.md))
- **Behaviour for flows.** A new element in the palette (right-click it, or use its arrow, to choose the kind): 13 kinds: five **steps** (a plain step and ones done by a user, done automatically, that expand into a sub-flow, or that repeat), three **choices** (a decision, an inclusive choice, a parallel split or join) and five **events** (a start, an end, and an event, a timer and a message in the middle of a flow). They are for what happens and how a flow behaves; things and concepts stay entities. Each kind has its own shape (a circle, a square with a mark, a rectangle with an arrow-shaped band) and a default colour; the small ones carry their label below. They can sit in a container (a lane), be connected like an entity, and carry one link to another diagram; they have no notes, tags or icons. The legend lists the kinds a diagram uses, with a switch to hide the rows for the session. The label of a small shape can go below (the default), above, left or right of it, or anywhere, tied to the shape by a dotted line (drag it while the shape is selected). Search finds them by kind, including the BPMN terms (try `gateway`, `user task` or `call activity`). The SVG, PNG and draw.io exports draw them. Inspired by BPMN, not compliant with it. ([ADR 0180](docs/decisions/0180-stencils-are-light-elements-for-events-and-verbs.md))

- **Assistants can build flows.** `edit_diagram` and `chd edit` have `add_behaviour` (a kind, a label, a place, optionally the label's position), `set_behaviour_kind` and `set_label_position` (for a behaviour's small shape or a container's side); `add_container` takes a label position too. `inspect_diagram` and `chd ask inspect` give the kind and label position of an element and, for an edge that crosses a container's border, the route ("Sales → Finance"). The skill's build guide, field reference and swim-lane recipe cover behaviours. ([ADR 0187](docs/decisions/0187-assistants-build-behaviours-and-read-crossings.md))

### File format

- A new node `type`, `"stencil"`, with `data.kind`, `data.labelPosition` and `data.labelOffset`, documented in [docs/file-format.md](docs/file-format.md). A version without it reads such a node as an entity.
- A container may have `data.labelPosition` (`"left"`, `"right"` or `"bottom"`; absent is the top). An older version draws the label at the top.

### Changed

- **The View menu groups its display switches in a Display submenu:** Animate edges, Minimap, Zoom controls and the new Mark crossings.
- **The corner panel of the canvas has no zoom in and zoom out buttons unless you ask for them** (View → Display → Zoom controls; the wheel, a trackpad and the keyboard still zoom). It now ends with the highlights, a Mark crossings switch and, last, the legend. ([ADR 0186](docs/decisions/0186-the-corner-panel-holds-what-the-canvas-shows-on-demand.md))
- **Dropdowns can be typed into.** In the properties panel and the other panels with a list (kind, font, line style, end markers, routing and so on), click the box and start writing: what you type appears in the box and the list narrows to the options that contain it (`Dec` finds Decision). Arrow keys and Enter choose, Escape closes.
- **The "React Flow" link in the corner of the canvas is hidden.** React Flow is credited in **Help → About** and in the third-party notices. ([ADR 0179](docs/decisions/0179-the-react-flow-link-is-hidden-and-the-library-is-credited-elsewhere.md))

## 0.10.0 (2026-11-15)

### Added

- **Edges that attach by themselves.** Drop a connection on the dashed target that appears in the middle of an element, or right-click an edge and choose **Attach automatically**, and that end of the edge picks the side of its element that faces the other one, and a point on it, and follows as you move the elements. **Fix to current points** makes it fixed again; an edge dropped on a point stays where it is. An edge with no connection point saved in the file now attaches this way too, where it used to leave by the top. Assistants can use `"auto"` as a handle in `connect` and `set_edge_handles`. ([ADR 0178](docs/decisions/0178-edge-ends-with-no-connection-point-attach-themselves.md))
- **File → Show in Folder** shows the open diagram's file in the system's file manager (Explorer, Finder, or the desktop's own on Linux).

### Changed

- **Connection points slide a little to straighten edges.** Where two facing elements are almost in line, each end of the edge between them moves up to 10 px along its side so the edge runs straight; further out of line, the edge bends as before. Nothing is stored, so a person's and an assistant's diagram behave alike. ([ADR 0176](docs/decisions/0176-connection-points-slide-a-little-to-straighten-edges.md))
- **Assistants can route edges.** A new `route_edges` operation (in `edit_diagram` and `chd edit`) gives edges a right-angled route through the free space round the elements they do not join, with a lane of their own where there is room; without ids it takes the edges the layout check reports. It also puts each routed edge on a connection point of its own on the side facing its other end, in order along the side and evenly spaced as in the app (`connectionPoints: "keep"` leaves them), and places no element. ([ADR 0174](docs/decisions/0174-route-edges-is-an-edit-operation-that-draws-edges-only.md), [ADR 0177](docs/decisions/0177-route-edges-chooses-the-connection-points-it-routes-from.md))
- **An assistant's connection points look like yours.** `add_connection_point` now spreads a side's points evenly, as the app does; its `offset` only says where in the order the new point goes. ([ADR 0175](docs/decisions/0175-assistants-make-what-a-person-can-make.md))
- **`set_edge_handles`** moves an edge to another connection point of the same two elements, keeping its id, label, tags and style (`edit_diagram`, `chd edit`).
- **An assistant that builds with `edit_diagram` reads less and is told less.** A one-page `build` topic (`get_format_spec`, `chd spec build`) replaces the core rules and three references (about 78 KB) for that way of working, an edit answers with the layout problems that involve what it touched and a count of the rest, answers carry new ids and changed fields instead of the whole element, and `inspect_diagram` (`chd ask inspect`) takes `issues_only`, `ids` and `container`. The server also says which build it is. ([ADR 0171](docs/decisions/0171-an-edit-answers-with-the-problems-it-touched.md), [ADR 0172](docs/decisions/0172-building-with-edit-diagram-reads-a-one-page-topic.md))
- **The layout check flags an edge label on a container's wall** (including one squeezed outside a container that has room) **and one that covers a container's own title,** and `list_files` says when folders below its depth limit were left out. ([ADR 0161](docs/decisions/0161-the-layout-check-judges-edges-as-they-are-drawn.md))
- **The Claude Desktop extension leaves out what a repository's `.gitignore` names** (build output, dependencies) when it lists and searches files, and says which folders it left out; `list_files` answers with 100 files a page and no modified time. ([ADR 0173](docs/decisions/0173-listings-and-searches-leave-out-what-gitignore-names.md))

### File format

- No new field. An edge end with no connection point named is now drawn on the side facing the other element, where it was drawn at the first point (the top); the rule is in [docs/file-format.md](docs/file-format.md). Files from 0.9.0 open as before, and a file made here opens in 0.9.0 with those ends at the top.

## 0.9.0 (2026-11-10)

### Added

- **Create many elements from a pasted table.** Right-click the Entity or Container button and paste a table with a header row, copied from a spreadsheet or comma-separated. The column named Name is the label, Description becomes the note (a file each, written on save), Domain, Group or Container names the group (kept as a tag for now, elements are not put into containers yet), and every other column becomes a tag. Rows with the same name merge into one element; a preview shows what each column will be and lets you change it. A value a required tag does not allow is left at its default and listed. A paste of one label per line works as before. ([ADR 0168](docs/decisions/0168-create-elements-from-a-pasted-table.md))
- **Export to draw.io.** **File → Export → draw.io…** and `chd export --format drawio` (or an output ending in `.drawio`) write a diagram as a draw.io / diagrams.net file, so it can be opened and edited there. Containers and what is inside them, connections with their attachment points and waypoints, labels, colours, fonts, arrowheads (crow's feet included), icons and tags (as draw.io data) come across. What draw.io has no place for or can only approximate (the legend, notes, the threat matrix, the exact path of a curved or stepped connection) is listed after the export, so nothing is lost silently. It is a one-way copy: edits made in draw.io do not come back. ([ADR 0167](docs/decisions/0167-drawio-export.md))
- **Slide a connection's label along its line** by holding Alt and dragging the label. It follows the line round bends and curves, and the Position slider in the Label section of the properties panel shows the result. One undo step per drag. ([ADR 0164](docs/decisions/0164-alt-drag-slides-an-edge-label-along-its-edge.md))
- **A highlight can have no colour,** to leave an element out. Press ∅ beside a highlight's colour (or give an assistant's `set_highlight` the colour `transparent`) and elements with that value, typically `N/A`, keep their own look when the highlight is switched on, so a system boundary no longer takes the colour of the entities inside it. It has no legend row. An older version of the app draws such an element's border invisible. ([ADR 0163](docs/decisions/0163-a-transparent-highlight-leaves-an-element-out.md))

- **Linux and macOS downloads:** each release now also carries a Linux AppImage and deb and a macOS DMG (Apple Silicon and Intel). **They have not been tested on real hardware**, are labelled so, and the macOS app is not notarised. Reports are welcome. ([ADR 0166](docs/decisions/0166-linux-and-macos-builds-published-as-untested.md))

### Changed

- **The licence and the third-party notices are installed next to the program** (`LICENSE.txt`, `THIRD-PARTY-NOTICES.md`; in the app's Resources folder on macOS), and a release's notes link to the source it was built from. The release is now checked by installing the installer silently and running `chd --version` before it is published. ([ADR 0165](docs/decisions/0165-the-release-installs-its-own-installer-and-ships-the-licence.md))

## 0.8.0 (2026-11-09)

### Added

- **The Windows installer can put `chd` on your PATH.** A new checkbox on its options page, **Add the chd command to your PATH** (unticked by default), adds the app's `bin` folder to your user PATH so `chd` works by name in a new terminal; uninstalling takes exactly that entry out again, and a PATH it cannot read safely is left alone. ([ADR 0162](docs/decisions/0162-the-installer-can-put-chd-on-the-path.md))
- **An assistant is told when an edge is drawn across an element, when edges cross, and when an edge label sits on an element, another edge or another label.** The answers of `edit_diagram`, `inspect_diagram`, `chd edit` and `chd ask inspect` judge each edge on the path that is drawn (curves, bend points and routing style included, not a straight line), so an assistant that cannot look at its diagram can still find and fix these. ([ADR 0161](docs/decisions/0161-the-layout-check-judges-edges-as-they-are-drawn.md))
- **Save As asks what to copy.** It opens a dialog with a path (set by the system's save picker) and three switches: **Notes**, **Images and custom icons**, and **Linked diagrams, recursively, with the same settings**, each with how many files it covers. What is ticked is copied into a folder named after the new diagram (`Copy.chd` and `Copy/`); what is not ticked, and anything that cannot be copied (missing, or outside the diagram's folder), is removed from the copy and listed, and the original is never changed. Linked diagrams keep their place relative to the original and are each copied once, with their own notes and images. The name and the folder must both be free, so nothing is ever replaced. ([ADR 0160](docs/decisions/0160-save-as-copies-into-a-folder-named-after-the-new-diagram.md))
- **One notice when files change outside the app.** If the diagram or a note you have open or edited was changed by another editor, git or an assistant, a single notice lists the files, says which of them you have unsaved edits to, and offers Review changes, Reload (only those files, asking first if edits would be lost) and Ignore. Before, the diagram and the open note had separate notices, and an unedited open note was refreshed without saying so. ([ADR 0159](docs/decisions/0159-one-notice-for-every-file-that-changed-outside-the-app.md))
- **Unsaved note text is no longer lost when its element is deleted.** It is kept and listed in Diagnostics (and counted in the View menu), with Copy text and Discard; undoing the deletion brings it back.
- **The side panels can be made wider or narrower.** Drag the left edge of the panel on the right (notes, diagnostics, changes, layers, preferences), use the arrow keys on it, or double-click it for the default width; the width is kept for next time and is the same for every panel. The list in the review window has the same handle (its width lasts while that window is open). ([ADR 0158](docs/decisions/0158-side-panel-width-and-the-minimap-are-preferences.md))
- **The minimap can be hidden.** A small button on its corner and **View → Minimap** switch it off and on, and the choice is kept. ([ADR 0158](docs/decisions/0158-side-panel-width-and-the-minimap-are-preferences.md))
- **Help → Glossary…** explains the terms the app uses (diagram metamodel, edge direction set, notes, layers, the three kinds of settings and more), with a filter box. It is written once, in `docs/architecture/glossary.md`, and the app shows the plain part of each term. ([ADR 0157](docs/decisions/0157-menus-are-grouped-and-the-glossary-is-in-help.md))
- **The MCP server can be used from any app that supports MCP servers,** not only Claude Desktop, and on Linux too. **AI → Install the MCP server for → Other apps: copy server settings…** asks for a folder and whether existing files may be changed (off by default), and copies the settings to paste into the app. The server is also started by the new `chd mcp <folder>`. Claude Desktop keeps its one-click install under the same submenu. ([ADR 0110](docs/decisions/0110-claude-desktop-extension.md), [ADR 0138](docs/decisions/0138-the-mcp-server-carries-the-guidance-the-cli-carries-the-checks.md))
- **The size of the Ctrl-hover card can be set** under Preferences: its width and the height beyond which it is trimmed (it was fixed at 340 by 260 pixels, which is still the default). A longer note shows more of its text on a bigger card. ([ADR 0156](docs/decisions/0156-the-ctrl-hover-cards-size-is-a-preference.md))
- **Holding Ctrl (Cmd on a Mac) over an element now names its icons** in the card, one per corner (`top left: server`), so an icon can be read and not only recognised. Tags and icons are on lines of their own, named and colour-coded (required tags violet and first, other tags sky blue, icons fuchsia), so a tag and an icon are not taken for each other. An element whose only content is icons gets the card too. ([ADR 0155](docs/decisions/0155-the-ctrl-hover-card-names-an-elements-icons.md))
- **The window title and the Notes panel now show unsaved changes.** The title reads `<file name> — Context-Heavy Diagrams`, with a dot in front while the diagram or one of its notes is not on disk (it used to say only the app's name). The Notes panel shows **Unsaved** beside the note's name while its edits are only in memory, and **Saved** once the file has them. A note is still written when the diagram is saved, not when the panel closes. ([ADR 0154](docs/decisions/0154-unsaved-changes-show-in-the-window-title-and-the-notes-panel.md))
- **Drag a number field's label to change its value** in the properties panel and the Preferences panel (stroke width, font size, opacity, animation speed and the rest): drag sideways, one step per pixel, Shift for fine and Ctrl for coarse. The cursor hides and the drag carries on past the window edge; one drag is one undo step, and a plain click still focuses the box for typing. ([ADR 0152](docs/decisions/0152-drag-a-number-fields-label-to-change-it.md))
- **A reference for the `chd` command line** ([docs/cli-reference.md](docs/cli-reference.md)): every command, its options and exit codes, how to get `chd` on a machine, and worked examples with their output, including checking a draft or a committed version through a pipe. A test fails when a command, an option or an edit operation is missing from it.

### Changed

- **The menus are grouped.** A line now separates the kinds of entry in File, Edit, View and Help. **New** is a submenu (**Diagram**, **Diagram metamodel…**) and so is **Export** (**PNG…**, **SVG…**); the shortcuts are the same. The command palette lists them as `New: Diagram` and `Export: PNG…`, and now also lists the entries of **View → Changes**, which it missed. ([ADR 0157](docs/decisions/0157-menus-are-grouped-and-the-glossary-is-in-help.md))
- **The AI menu is organised by what you want to do:** **Copy AI instructions**, **Set up a folder for AI agents…** (it was **Enable AI assistance in a folder…**; it writes `AGENTS.md`, which most agents read, and `CLAUDE.md` with a skill, which Claude Code reads) and **Install the MCP server for**, with the Claude Desktop install as one entry in it.
- **A change in how an element looks is now a change in a review,** when the look carries meaning: fill, border colour, width and opacity, line style, markers, an edge's colour, width and animation, and icons. Such an element is coloured fuchsia as **Restyled**, with the old and new value in the hover card, and every changed line one under the other in the list with a chip beside each colour ("line style: solid → dotted"), its own count and its own heading in `chd diff`; an edge keeps its own look and gets a glow instead of being recoloured. Font, text alignment, label position and routing are still only marked with the paint brush. In `chd diff --json` each field has a `category` and a look has `before` and `after`, `counts` has `restyled`, and the old `restyled` count is now `cosmeticLook`; `--exit-code` exits 1 for a restyle alone. ([ADR 0153](docs/decisions/0153-a-look-that-carries-meaning-is-a-change-in-a-review.md))
- **The properties panel opens Fill, Border and Metadata, and starts with Font, Transform, Connection points and References closed,** since those are the ones used least. A section you open or close stays that way for the rest of the session, as before.
- **`chd help edit` now lists every operation `chd edit` takes**, with its fields. Before, it sent you to the Claude Desktop extension's tool for them. The extension and the command line print the same text. ([ADR 0150](docs/decisions/0150-chd-edit-and-chd-ask-build-a-diagram-from-the-command-line.md))

### Fixed

- **Save As no longer leaves the copy pointing at the original's files.** Notes you never opened stayed in the old folder while the new diagram still referred to them, so editing one changed the other; images and linked diagrams were not carried either. See Save As asks what to copy.

## 0.7.0 (2026-11-07)

### Added
- **An assistant can build a diagram step by step in Claude Desktop, without a shell.** The extension has three new tools: `edit_diagram` applies a list of operations (add an entity, container, text or line, connect, move, resize, restyle, nest, remove) and answers with what each made and what is wrong with the layout so far; `inspect_diagram` lists the elements as they stand; `room_for_label` says how much space two connected elements need for an edge label. The assistant decides all placement. The operations also set tags (on elements, edges and the diagram), required tags, highlights and legend entries, links to other diagrams and notes, and `remove` deletes an element or an edge. It can also bend an edge through routing points and link a new drill-down diagram, which goes in the folder named after its parent as the editor does. Icons and the security matrix are not covered yet. The command line has the same through `chd edit` (the operations as JSON on standard input or `--ops`, and `--base <fingerprint>` to change a file that exists) and `chd ask inspect` / `chd ask room`, with the same answers; an assistant with a shell no longer needs the extension to build a diagram, and a pipeline can build one reproducibly. ([ADR 0150](docs/decisions/0150-chd-edit-and-chd-ask-build-a-diagram-from-the-command-line.md)) Its answers are short (an element's id and, after a move or an add, its place and size), problems of one kind are collapsed into one line with their number, and the layout check also finds a label that does not fit its box. ([ADR 0148](docs/decisions/0148-an-assistant-builds-a-diagram-by-operations-that-answer.md))

### Changed
- **The Claude Desktop extension can search the text of its files without a shell.** `search_files` finds lines as grep does (plain text or a regular expression, ignoring case, a glob, a subfolder, context lines, a cap), in plain Node on every system. `list_files` can show the folders one level at a time with their number of files, take a glob and page through a long list, and `read_file` can read a range of lines. `list_files` says when folders below its twelve levels were left out. The skill and `AGENTS.md` now tell an assistant that has these tools to build with `edit_diagram` instead of writing the JSON. ([ADR 0149](docs/decisions/0149-the-extension-searches-file-text-in-process.md))
- **The Claude Desktop extension can read any file in its folder, not only a list of text types:** source code, PDFs, pictures, spreadsheets. Text comes over as text, pictures as images and other binary files as attachments; what Claude can make of an attachment depends on the client. Executables, installers, archives, disk images, video and audio stay blocked, and writing is unchanged. `list_files` can be narrowed to one subfolder. ([ADR 0110](docs/decisions/0110-claude-desktop-extension.md))

## 0.6.0 (2026-11-06)

### Added
- **The Claude Desktop extension can check a diagram against a diagram metamodel and show what changed.** `check_diagram` applies a built-in metamodel or a `.chdmeta` file in the folder, and `diff_diagrams` compares two diagrams in the folder, with the same results as `chd check` and `chd diff`. The `conformance` topic of `get_format_spec` explains the checks. The command line stays what a build pipeline relies on. ([ADR 0138](docs/decisions/0138-the-mcp-server-carries-the-guidance-the-cli-carries-the-checks.md))
- **The extension can compare a diagram with its last commit in git,** and write diagram metamodels. `diff_diagrams` takes a `revision` as `chd diff --rev` does, which makes `git show` the only program the extension starts; the install dialog says so, and that history can bring back content since removed. `create_file` and `update_file` also write `.chdmeta` files, validated first and with the same stale-edit check as a diagram. ([ADR 0142](docs/decisions/0142-the-extension-may-run-git-show-to-read-an-earlier-version.md), [ADR 0143](docs/decisions/0143-the-extension-writes-diagram-metamodels.md))
- **A diagram metamodel can be validated on its own.** `chd validate rules/house.chdmeta` and the extension's `validate_metamodel` list every way the file breaks the format, without applying it to a diagram. The skill's guide for writing a metamodel now says what to ask for and what the format cannot express. ([ADR 0143](docs/decisions/0143-the-extension-writes-diagram-metamodels.md))
- **A draft can be checked and compared before it is written.** `chd check -` and `chd diff <file> -` read the diagram from standard input, and the extension's `check_diagram` and `diff_diagrams` take it as `content` / `new_content` / `old_content`. Notes are not compared for a draft. ([ADR 0145](docs/decisions/0145-a-draft-is-checked-and-compared-without-being-written.md))
- **The validator warns when an edge label does not fit in the gap between the two elements,** with the line and arrowhead still showing either side of it. `chd validate` and the extension's `validate_diagram` say which edge, how many pixels it has and about how many it needs. The layout guide the assistants read now gives the room two elements joined by an edge need (it contradicted itself: 20 px between related elements, 100 to 160 px for a label). The warning is a minimum; the guide's figures are the target. **Diagnostics** lists the same edges under **Layout**; click one to select the edge and frame the two elements. ([ADR 0146](docs/decisions/0146-elements-joined-by-an-edge-keep-a-gap-for-the-label.md))

### Changed
- **A conformance profile is now called a diagram metamodel:** the complete set of rules one kind of diagram or architecture follows, of which a diagram is checked against exactly one. The file is `<name>.chdmeta`, the option is `chd check --metamodel`, the Diagnostics panel, the File menu and Preferences say metamodel, and `--json` names it `metamodelName` (it was `profileName`). Your `.chdprofile.json` files, `--profile`, and the folder you chose in Preferences keep working. ([ADR 0144](docs/decisions/0144-a-conformance-profile-is-called-a-diagram-metamodel.md), [format](docs/metamodel-format.md))

### File format
- **A diagram metamodel carries `metamodelVersion`** where a profile carried `profileVersion`. Both are read; a file with both is refused, and new files use the new key. The diagram format (`.chd`) is unchanged. ([docs/metamodel-format.md](docs/metamodel-format.md))

## 0.5.1 (2026-11-04)

### Fixed
- **Animated edges did not move at all on a computer that asks for reduced motion,** whatever **Animate edges** was set to, and holding Ctrl over an edge did nothing either. Windows reports reduced motion when "Animation effects" is off, and also in a Remote Desktop session and in many virtual machines. **Animate edges** is now **Follow the system** (the default), **Always on** or **Always off**, and your own choice wins over the system: **View → Animate edges** (Ctrl+Shift+A) makes one, and holding Ctrl over an edge while it is still shows it moving. A computer that asks for reduced motion still starts with animation off, and you turn it on once. ([ADR 0141](docs/decisions/0141-animated-edges-are-an-edge-style-field.md), [known issues](docs/known-issues.md))

## 0.5.0 (2026-11-04)

### Added
- **An edge can be animated, to mark something live.** **Animation** in an edge's Line properties is None (the default), Flow (the dashes travel from the source end to the target end) or Pulse (a dot does), with a **Speed**, a **Direction** (forward or reverse) and, for a pulse, a **Pulse distance** that turns it into an evenly spaced stream. The copy-style brush carries all of it to other edges, and a legend line picked from an animated edge moves too. **View → Animate edges** (Ctrl+Shift+A, also in Preferences) switches every animation off; with it off, hold Ctrl (Cmd) over an edge to see it move. The system's reduced-motion setting also stops the movement. An SVG or PNG export and the compare window show it still, so say what "live" means in a tag, label or the legend as well.
- **A dashed, dotted or flowing line can set its dash length and gap** (**Dash length** and **Dash gap** in the edge's Line properties). ([ADR 0141](docs/decisions/0141-animated-edges-are-an-edge-style-field.md))
- **The validator reports an edge that names a connection point its element does not have.** Such an edge is not drawn; `chd validate`, the skill's script and the Claude Desktop extension now say so as an error, and warn about names the app still reads but no longer writes (node type `shape`, `data.details`, legend kind `shape`, `matrixShapeIds`/`hiddenShapeIds`). ([known issues](docs/known-issues.md))
- **An assistant can write an architecture profile for you.** The skill now explains what to ask you, the format, and how to test the result with `chd check`. ([ADR 0131](docs/decisions/0131-conformance-profiles.md))
- **The Claude Desktop extension names the folder it serves** in its file listing, and `get_format_spec` with `all` returns the core rules and an index of topics instead of 66 KB at once.

### Fixed
- **An edge with no stored end marker was drawn as a plain line,** although the properties panel said it had the default closed arrow. This hit a new edge drawn with no default style set, an edge written by hand or by an assistant without a `style`, and an edge painted from one that had none; changing the marker and back hid it. ([known issues](docs/known-issues.md))

### Changed
- **A note is called a note all the way down.** The Markdown file behind an element was already **Open note** in the menus; the file, the folder and the command line now use the same word. New notes are created in a `notes` folder next to the diagram, and the AI instructions, the skill and the Claude Desktop extension write `notes`. ([ADR 0140](docs/decisions/0140-the-markdown-files-behind-an-element-are-called-notes.md))

### File format
- **An edge's `style` may carry `animation`** (`"flow"` or `"pulse"`; absent means none), `animationSpeed` (a multiplier, absent means 1) `animationDirection` (`"reverse"`; absent means forward), `pulseDistance`, and `dashLength` and `dashGap`, and a legend entry of kind `"line"` may carry the same fields. Older files open unchanged, and an older version draws such an edge still and keeps the field on save. ([docs/file-format.md](docs/file-format.md))
- **`data.details` is now `data.notes`.** Older files open unchanged: `details` is read as `notes` and becomes `notes` on the next save, which also moves the note files from the `details` folder into `notes` and removes the folder once it is empty. In a repository that save shows as renames. The reverse does not hold: a version before 0.5.0 ignores `notes` and drops the link to a note when it saves a file that has one, so update before opening such files in an older version. ([docs/file-format.md](docs/file-format.md))

## 0.4.0 (2026-11-03)

### Added
- **A Windows installer on the releases page**, built by CI from the tagged commit, with a checksum file. It is not signed yet, so Windows asks you to confirm the install; see the README. ([ADR 0139](docs/decisions/0139-releases-built-by-ci-from-a-version-tag.md))
- **Search can exclude and match exactly.** A leading `-` negates a term (`-has:notes`, `-tag:state=draft`), and `tag:key==value` matches a tag exactly. ([ADR 0096](docs/decisions/0096-search-facets-and-shared-match-predicate.md))
- **A link icon on the peek card** of an element that links to a sub-diagram. ([ADR 0093](docs/decisions/0093-details-peek-card-on-modifier-hold.md))

### Changed
- **The Markdown files behind an element are now called notes.** The context menu says **Open note**, search uses `has:notes` (`has:details` still works), and the free-text element is the **Textbox**. The AI instructions and the Claude Desktop extension use the same words.
- The product name is spelled **Context-Heavy Diagrams** again. ([ADR 0114](docs/decisions/0114-product-name-context-heavy-diagrams.md))

### File format
- No change. The note path is still stored in the `details` field.

## 0.3.0 (2026-10-26)

### Added
- **Review what changed between two versions of a diagram.** A compare window draws the later version with added, removed, link-or-note-changed and modified elements coloured and the rest dimmed, with a list to step through, hover details and a revert per change. Open it from the "changed outside the app" banner, or from **View → Changes**, which now holds **Changes since last save…**, **Review changes on disk** and **Compare with git revision…**. The changes panel can reset, remove or restore one element at a time. If an assistant gave every element a new id, the window offers to match them up. ([ADRs 0132 to 0136](docs/decisions/0132-the-compare-window-is-a-read-only-canvas-with-its-own-bridge.md))
- **`chd diff`** prints the same review for a terminal or CI, between two files or between a file and a git revision, with `--json` and `--exit-code`. ([ADR 0137](docs/decisions/0137-chd-diff-the-same-review-without-the-app.md))
- **Architecture conformance checks.** A rules file (a profile) is applied to a diagram from the Diagnostics panel or with `chd check`. ([ADR 0131](docs/decisions/0131-conformance-profiles.md), format in [docs/metamodel-format.md](docs/metamodel-format.md))
- **SVG export**: **File → Export as SVG…**, and `chd export` writes an SVG from a `.chd` file without the app. ([ADR 0124](docs/decisions/0124-svg-export-from-a-shared-pure-renderer.md))
- **A default font for the whole diagram**, stored in the file, with the fonts installed on the computer offered in the font lists. ([ADR 0130](docs/decisions/0130-diagram-default-font-and-installed-fonts.md))
- A legend line can be picked from an edge. ([ADR 0123](docs/decisions/0123-legend-line-picked-from-an-edge.md))

### Changed
- A new app icon: Huginn and Muninn, Odin's two ravens, on a tan tile. The drawing is pure vector, so the icon stays sharp at every size.
- Connection handles stay easy to hit when the canvas is zoomed out. ([ADR 0129](docs/decisions/0129-connection-handles-keep-a-minimum-screen-size.md))
- The View menu groups the commands for changes under **Changes**.

### File format
- A diagram may now carry a default font (`fontFamily`). Older files open unchanged; see [docs/file-format.md](docs/file-format.md).

## 0.2.1 (2026-10-19)
The first open-source release. No installers are published; build from source.
