# 0173: Style changes in the change review

## Status
Not Started. Logged 2026-11-04; for later.

## Goal
A change in the look of an element shows up in the review as a change, because the look often carries meaning: a dotted line against a solid one, red against green, a thicker line, a different arrowhead, an animation. Today a restyle is only a faint marker and the element is dimmed like an unchanged one ([ADR 0133](../../decisions/0133-what-counts-as-a-change-in-a-review.md)); this reverses that for the fields that matter.

## Questions to settle first
- **Which fields count.** The ones that carry meaning are probably a node's fill, border colour, border width and (for a line) line style and markers, and an edge's colour, width, line style, markers, animation and dash settings. A font size or a label position is cosmetic. Either a fixed list, or every style field with a way to hide the cosmetic ones.
- **How it is shown.** A new category with its own colour and badge, or a part of "Modified"; and a detail line on hover ("line: solid → dotted", "colour: red → green"), as the other categories already give.
- **Colours across themes.** Colours are stored in the dark theme's form and flipped for the light one ([ADR 0034](../../decisions/0034-theme-adaptive-color-value-flip.md)), so the comparison must be on the stored value, not the displayed one.
- **A restyle together with other changes** on the same element: one row, with both listed.
- **Revert per change** should restore the old look, as it does for the other kinds.

## Tasks
- [ ] Decide which style fields count, and the category and badge
- [ ] A new ADR that replaces the "style is not a change" part of ADR 0133 and says which fields count and why
- [ ] The classifier in `src/shared/compare/classify.ts`: per-field style differences, with the old and new value for the hover
- [ ] The compare window: colour, badge, legend count and the hover detail; keep the paint-brush marker for the cosmetic fields, or retire it
- [ ] `chd diff` prints the same, with `--json` carrying the changed fields ([ADR 0137](../../decisions/0137-chd-diff-the-same-review-without-the-app.md))
- [ ] The changes panel and revert for a restyle
- [ ] Diagram-level look: the legend entries (they carry line look too) and the edge direction set styles
- [ ] Tests for each counted field, a theme flip, and a restyle plus another change
- [ ] Update `docs/architecture/` and the skill's guidance on `chd diff` output

## Notes
Raised while using the review on diagrams where colour and line style mean something. An assistant that restyles edges ("make the planned ones dotted") is reviewed the same way, which is another reason to count it.
