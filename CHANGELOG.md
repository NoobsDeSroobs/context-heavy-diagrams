# Changelog

What changed for people using the tool, one entry per minor or major release. The reasons are in [docs/decisions/](docs/decisions/); the full history is in `git log`.

## 0.8.0 (unreleased)

### Added

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

- **Save As copies the notes you never opened.** They used to stay in the old folder while the new diagram still pointed at them.

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
