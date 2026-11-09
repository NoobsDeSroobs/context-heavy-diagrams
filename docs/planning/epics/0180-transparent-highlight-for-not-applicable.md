# 0180: A transparent highlight for "N/A"

## Status
Built (2026-11-09), to be tried in the app. A transparent highlight marks nothing ([ADR 0163](../../decisions/0163-a-transparent-highlight-leaves-an-element-out.md)); the example is `examples/highlight-not-applicable.chd`.

## Goal
A highlight colours every element that carries the tag value, containers included, so a system boundary turns the colour of its children. Setting the tag to `N/A` avoids it today by hand. Make that a supported pattern: a highlight whose colour is transparent, so an element set to `N/A` is not coloured.

## Tasks
- [x] Check whether a highlight accepts a transparent colour in the file format, the editor and the legend swatch; allow it if not (the format already does; the editor gets a no-colour button; the legend skips it)
- [x] Say in the `edit_diagram` help that `N/A` with a transparent highlight is the way to leave an element out
- [x] Check that the SVG and PNG export draw it as no fill (both use the same match function; SVG covered by a test)

## Notes
Seen in the second Immich trial. A per-highlight "applies to containers" switch was considered and left out: it is a file-format change for something a tag value already does.
