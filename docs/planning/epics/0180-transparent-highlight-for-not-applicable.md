# 0180: A transparent highlight for "N/A"

## Status
Not Started. Logged 2026-11-07; for later.

## Goal
A highlight colours every element that carries the tag value, containers included, so a system boundary turns the colour of its children. Setting the tag to `N/A` avoids it today by hand. Make that a supported pattern: a highlight whose colour is transparent, so an element set to `N/A` is not coloured.

## Tasks
- [ ] Check whether a highlight accepts a transparent colour in the file format, the editor and the legend swatch; allow it if not
- [ ] Say in the `edit_diagram` help that `N/A` with a transparent highlight is the way to leave an element out
- [ ] Check that the SVG and PNG export draw it as no fill

## Notes
Seen in the second Immich trial. A per-highlight "applies to containers" switch was considered and left out: it is a file-format change for something a tag value already does.
