# 0150: Visual diff between two versions of a diagram

## Status
Not Started. Logged 2026-10-21 from the [comparison with other tools](../../comparison.md). Sparse on purpose: a possible differentiator, to be reviewed and discussed before any decision to build it.

## Goal
Show what changed between two versions of a diagram (for example the working file against an earlier git revision) visually, so a change can be reviewed without reading JSON.

## Why
A `.chd` file diffs cleanly as text, but a reviewer cares how the picture changed. GitHub cannot show that for a custom format. A tool built around git is well placed to.

## Two approaches (not exclusive)
1. **Structural diff drawn on the canvas.** Elements have stable ids, so added, removed, moved, restyled and relabelled elements can be told apart and drawn as an overlay (added, removed as a ghost, changed). Part of this exists: "changes since last save" ([ADR 0102](../../decisions/0102-changes-since-last-save-scope.md)). Precise, selectable and needs no image comparison, but it is only as good as the rules for what counts as a change.
2. **Pixel diff of two rendered images.** Render both versions to PNG in memory over the same bounds and show a swipe, blink or difference view. Catches any visual change without knowing the structure; but says nothing about which element changed, and one moved box makes much of the image differ. Best suited to CI: with a command-line export ([epic 0144](0144-svg-and-command-line-export.md)) a job can render the old and the new revision and attach a difference image to a pull request.

## Open questions
- Where the old version comes from: the git history (needs the `git` program, which is offline but an assumption), or a file the user picks.
- Whether the two approaches ship together or the structural one first (first guess).
- How notes (the Markdown files) and linked diagrams take part.
- Alignment: both images need the same bounds, or the pixels will not line up.

## Related
[ADR 0102](../../decisions/0102-changes-since-last-save-scope.md), [epic 0117](0117-changes-since-last-save.md), [epic 0144](0144-svg-and-command-line-export.md).
