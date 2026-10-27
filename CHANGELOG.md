# Changelog

What changed for people using the tool, one entry per minor or major release. The reasons are in [docs/decisions/](docs/decisions/); the full history is in `git log`.

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
