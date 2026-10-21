# 0144: SVG export and a command-line export

## Status
Not Started. Logged 2026-10-21 from the [comparison with other tools](../../comparison.md). **First in line** (agreed 2026-10-21); imports and exports follow, then a new prioritisation.

## Goal
Export a diagram as SVG from the app, and let a command (`chd export`) produce the same SVG or PNG from a `.chd` file without opening the app, so that images in wikis and READMEs can be regenerated in CI whenever the diagram changes. A PDF export would then be a small follow-up.

## Why
PNG is the only export today, which is the weakest point against almost every other tool and the main way a diagram reaches Confluence or a README. A command-line export also makes a diagram a build artefact: commit the `.chd` file, let CI produce the image.

## What exists today
- PNG export draws the live canvas to an image with `html-to-image`, with a legend added ([ADR 0051](../../decisions/0051-png-export.md)). It only runs inside the app window.
- The `chd` command line offers `spec`, `validate` and `hash`. It does not render anything.

## Open questions
1. **How the command renders.** (a) Convert the live canvas to SVG: matches the screen, but the result is closer to an embedded page than clean vector shapes, and it needs the app. (b) A pure function from diagram to SVG shared by the app and the command: true vector output and no Electron needed, but a second renderer that must stay in step with the node and edge components and the CSS. (c) The command starts the app headless. First guess: a short spike comparing (a) and (b) on three gallery diagrams before choosing.
2. **Fidelity.** Fonts (the same diagram looks different per machine, see [epic 0139](0139-diagram-default-font-and-available-fonts.md)), icons (inline SVG and raster), text wrapping, the legend and active highlights, and the theme.
3. **Determinism.** The same file should give a byte-identical image, so CI diffs stay quiet.
4. **What to export.** The whole diagram or a selection, margins and transparency as in the PNG dialog, and whether links become clickable.

## Tasks
- [ ] Spike on the renderer question; record the choice in an ADR
- [ ] SVG export in the app (File menu and the export dialog)
- [ ] `chd export` for SVG and PNG, with the stale-edit rule not applicable (it only reads)
- [ ] Tests, including a round trip over the gallery diagrams
- [ ] Update `docs/comparison.md` and the getting-started guide
- [ ] Follow-up: PDF export

## Related
[ADR 0051](../../decisions/0051-png-export.md), [epic 0145](0145-read-only-html-export.md) (likely to share the renderer), [epic 0150](0150-visual-diff-between-versions.md) (the CI image diff needs this).
