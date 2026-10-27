# Getting started

A ten-minute tour: open an example, draw a small diagram, hang context on it, link a deeper diagram, and find your way around. "Ctrl" means Cmd on macOS. The full shortcut list is always under **Help → Keyboard shortcuts…**, and **Ctrl+K** opens a command palette that finds every menu action by name.

First run the app from source; the steps are in the [README](../README.md#try-it).

## 1. Look at an example

**File → Open…** (or drop a file onto the window) and pick [`examples/hello-world.chd`](../examples/hello-world.chd), the smallest diagram. Then try the [gallery](../examples/gallery/README.md), for example the C4 drill-down: Ctrl-click a node that has a link to open the diagram behind it. Each diagram opens in its own window.

Move around by dragging empty canvas (pan) and with the mouse wheel (zoom). **Ctrl+0** fits the whole diagram in view.

## 2. Draw a small diagram

1. **File → New** (Ctrl+N).
2. Drag an **entity** from the palette onto the canvas. The palette also has **containers** (boxes that hold other elements), **text** and **free-form lines**. Right-click an entity or container button to create many from a pasted list.
3. Double-click the element to edit its label. Enter commits; Shift+Enter starts a new line; Esc cancels.
4. Drag from a connection point on one entity to another to connect them. The edge stays attached and re-routes when either end moves. Drag a selected edge's end to move it to another connection point.
5. Drag an entity into a container to nest it. Dragging the container moves what is inside.
6. **File → Save** (Ctrl+S). The result is a plain `.chd` text file; autosave and crash recovery keep a safety copy while you work.

Selection works as in most editors: click, Shift+click to add, Shift+drag to box-select, Ctrl+A for everything. Alt+drag leaves the original in place and drags a copy. Ctrl+Z undoes.

## 3. Put the context behind the box

Right-click an element for its menu:

- **See details** opens a Markdown notes panel for the element. The notes are saved next to the diagram as a separate `.md` file, so they diff and review like any other text.
- **Add icon** picks from the bundled icons or your own SVG/PNG files.
- **Reference images…** pins pictures to the element. They show in floating windows and never become part of the diagram or its exports.

Tags and other key-value metadata are in the **Metadata** section of the properties panel when an element is selected: type a key and a value to add one. A diagram can also define *required* fields with allowed values, under **View → Diagram settings**. Search (Ctrl+F) understands queries such as `tag:env=prod` or `has:details`.

## 4. Link a deeper diagram

Right-click an element and choose **Link to diagram…** to point it at another `.chd` file. Ctrl-click the element to follow the link; if it has none, Ctrl-click offers to create and link a new diagram. Links point downward only, so any diagram in a tree can be opened on its own as a root. Hold Ctrl while hovering an element to peek at its details, tags and link without opening anything.

## 5. See the picture from different angles

- **Highlights and the legend** colour elements by tag value, so one diagram can answer "what is production?" or "where does personal data live?".
- **Search with isolate** dims everything that does not match.
- **Layers**, **Diagnostics** (missing files, an empty legend, and similar) and **Style Palette** are in the **View** menu.
- **File → Export as PNG…** and **Export as SVG…** write an image with an auto-generated legend. The SVG is real vector, so it stays sharp and opens in Inkscape or Illustrator. `chd export <file.chd>` writes the same SVG from a terminal or a CI job, without opening the app (`chd export --help` lists the options).
- **Reviewing changes.** **View → Changes → Changes since last save…** lists what you changed since the last save, with **Reset**, **Remove** and **Restore** per row (Ctrl+Z undoes one). **View → Changes → Compare with git revision…** (or **Review changes** on the "changed outside the app" banner, when an assistant or another tool edited the open file) opens a window with the later version drawn on the real canvas: green is added, red removed (a dashed ghost), yellow modified (label, tags, security, what a connection joins), orange a changed link or note, and everything else is dimmed; a moved or resized element is not a change, and restyled ones can be marked with a paint brush. Hold Ctrl and hover an element or connection to see what changed, step through the list with the arrow keys (N and P), tick changes off, and revert one in the editor window. Connections that left with a deleted element are listed under it. If an assistant rewrote the file and every id changed, **Match them up** pairs the elements by name and place (a guess, marked as one). `chd diff <file.chd>` prints the same review in a terminal (`--rev`, `--match`, `--json` and `--exit-code` are in `chd diff --help`).
- **Architecture checks.** In **Diagnostics**, pick a profile (hexagonal and data-flow diagram are built in) to see where the diagram breaks that style's rules; click a finding to find the element. `chd check <file.chd> --profile hexagonal` does the same in CI and exits non-zero on errors. A diagram needs a `role` tag on its elements and an edge direction set named for what its arrows mean ("Depends On", "Flows To"); [`examples/conformance/`](../examples/conformance) has diagrams that pass and that fail, and **File → New conformance profile…** starts a profile of your own ([the format](conformance-profile-format.md)).
- The [`security-rollup`](../examples/gallery/technical/security-rollup/README.md) example shows the security matrix view rolling scores up through linked diagrams.

## 6. Use it with git

`.chd` files are deterministic JSON with a fixed key order, so a small edit gives a small diff. **View → Changes → Changes since last save…** lists what you changed before you commit. The file format is specified in [file-format.md](file-format.md), so other tools can read or write it.

## 7. Working with an AI assistant

The **AI** menu sets up a folder so an assistant such as Claude can read and edit diagrams safely: copy-paste instructions for a plain chat, a skill and `AGENTS.md` for agents working in a folder, and a local extension for Claude Desktop. Anything an assistant reads is sent to its provider. See [ai-integration.md](architecture/ai-integration.md).

## Where next

- [`examples/`](../examples/README.md) for more diagrams to open and take apart.
- [`docs/architecture/`](architecture/overview.md) for the design principles.
- [`docs/decisions/`](decisions/) for why things work the way they do.
- [`comparison.md`](comparison.md) for how this tool compares with other diagramming tools.
- Something missing or wrong here? Open an issue; see [CONTRIBUTING.md](../CONTRIBUTING.md).
