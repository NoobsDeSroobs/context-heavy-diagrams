# Changelog

What changed for people using the tool, one entry per minor or major release. The reasons are in [docs/decisions/](docs/decisions/); the full history is in `git log`.

## 0.5.0 (2026-11-03)

### Changed
- **A note is called a note all the way down.** The Markdown file behind an element was already **Open note** in the menus; the file, the folder and the command line now use the same word. New notes are created in a `notes` folder next to the diagram, and the AI instructions, the skill and the Claude Desktop extension write `notes`. ([ADR 0140](docs/decisions/0140-the-markdown-files-behind-an-element-are-called-notes.md))

### File format
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
- **Architecture conformance checks.** A rules file (a profile) is applied to a diagram from the Diagnostics panel or with `chd check`. ([ADR 0131](docs/decisions/0131-conformance-profiles.md), format in [docs/conformance-profile-format.md](docs/conformance-profile-format.md))
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
