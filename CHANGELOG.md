# Changelog

What changed for people using the tool, one entry per minor or major release. The reasons are in [docs/decisions/](docs/decisions/); the full history is in `git log`.

## 0.7.0 (unreleased)

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
