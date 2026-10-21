# 0144: SVG export and a command-line export

## Status
In Progress (started 2026-10-21; logged the same day from the [comparison with other tools](../../comparison.md)). SVG export in the app and `chd export` for SVG are built and tested; what is left is a live check of the app's menu item, the PNG from the command line and PDF. **First in line** (agreed 2026-10-21); imports and exports follow, then a new prioritisation.

## Goal
Export a diagram as SVG from the app, and let a command (`chd export`) produce the same SVG or PNG from a `.chd` file without opening the app, so that images in wikis and READMEs can be regenerated in CI whenever the diagram changes. A PDF export would then be a small follow-up.

## Why
PNG is the only export today, which is the weakest point against almost every other tool and the main way a diagram reaches Confluence or a README. A command-line export also makes a diagram a build artefact: commit the `.chd` file, let CI produce the image.

## What exists today
- PNG export draws the live canvas to an image with `html-to-image`, with a legend added ([ADR 0051](../../decisions/0051-png-export.md)). It only runs inside the app window.
- The `chd` command line offers `spec`, `validate` and `hash`. It does not render anything.

## Decided (2026-10-21, [ADR 0124](../../decisions/0124-svg-export-from-a-shared-pure-renderer.md))
- **Renderer:** a pure function from diagram to native SVG, shared by the app and the command, with the geometry, style defaults, colour flip and marker shapes extracted into shared modules. No spike: a DOM snapshot cannot be editable vector (ADR 0051) and a headless app needs a display on Linux CI.
- **Command PNG:** SVG first, then rasterise it with a small WASM rasteriser; the in-app PNG stays as it is.
- **Fidelity:** text is estimated, not measured (the reader's machine supplies the real font); icons are inline vector or embedded images; the legend is included and highlights are off unless asked for; the theme is chosen (`--theme`).
- **Determinism:** the same file gives the same bytes; tests check it for every gallery diagram.
- **What to export:** the whole diagram, with padding, background and legend corner as in the PNG dialog. Links are not clickable yet.

## Open questions
1. **The WASM rasteriser for a PNG from the command line:** which one, how text gets its fonts without a system font set, and what it adds to the install size.
2. **Selection export** (only the selected elements) and **clickable links** in the SVG, both skipped for now.
3. **A shared default font** across machines ([epic 0139](0139-diagram-default-font-and-available-fonts.md)) would narrow the gap between the SVG's text and the canvas.

## Tasks
- [x] Decide the renderer; record the choice in an ADR ([ADR 0124](../../decisions/0124-svg-export-from-a-shared-pure-renderer.md))
- [x] SVG export in the app (File menu and the export dialog)
- [x] `chd export` for SVG, with the stale-edit rule not applicable (it only reads, and refuses a non-.svg output)
- [x] Tests, including a round trip over the gallery diagrams
- [x] Update `docs/comparison.md` and the getting-started guide
- [ ] Live-test **File → Export as SVG…** in the app (dev build, then a packaged build: the command's built-in icons come from `app.asar`) and open the result in a browser and in Inkscape
- [ ] Linux and macOS check of the app's save dialog and `chd export` (cross-platform rule)
- [ ] `chd export` for PNG (WASM rasteriser)
- [ ] Follow-up: PDF export

## Related
[ADR 0051](../../decisions/0051-png-export.md), [epic 0145](0145-read-only-html-export.md) (likely to share the renderer), [epic 0150](0150-visual-diff-between-versions.md) (the CI image diff needs this).
