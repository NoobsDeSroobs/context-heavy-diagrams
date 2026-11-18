# 0197: Icon pack follow-ups

## Status
Not Started. What the first version of installable icon packs ([ADR 0188](../../decisions/0188-icons-come-from-installed-packs-drawn-as-cleaned-inline-svg.md)) left for later.

## Goal
Finish the parts of icon packs that were parked when the first version shipped in 0.12.0.

## Tasks
- [ ] Example diagram using a small pack made for the purpose ([ADR 0151](../../decisions/0151-every-visible-feature-has-an-example-diagram.md)), and `examples/README.md` naming it
- [ ] Offer an update when the app's Tabler is newer than the installed one
- [ ] Slow canvases: measure a large diagram with many installed icons before adding the `<img>` fallback for fixed-colour icons
- [ ] The command-line SVG and draw.io export reads Tabler from the package but leaves out an icon of any other pack: decide whether it finds the app's packs folder, takes a `--icon-packs` folder, or stays as it is. The CLI and tests that open diagrams with built-in icons need the Tabler pack or its bundled copy
- [ ] Duplicate ids in an SVG export: one icon on several elements repeats its ids (a gradient, a clip path) in the file; the copies are identical so it draws right, but the file is not strictly valid. Isolate per use if a viewer objects

## Notes
Later ideas, not planned: zip export of a pack, per-icon meanings in search, recolouring by the person, the extension and command line listing and writing installed icons, fetching packs from a central repository, a hash to tell two machines' `Misc icons` apart, choosing another pack when adding an icon.
