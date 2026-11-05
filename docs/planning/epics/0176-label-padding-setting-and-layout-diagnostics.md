# 0176: A label padding setting, and layout problems in Diagnostics

## Status
Not Started. Logged 2026-11-05; follows [0162](0162-minimum-distance-between-connected-elements.md).

## Goal
Let the person say how much room they want around an edge label, and show the edges that break it in the Diagnostics panel, so the soft rule is checked by the program and not left to an assistant's judgement.

## What it has
- **One number, the padding,** measured from the label's box (not its text), so it means the same across and down. The gap an edge needs is `label width + 2 × padding` across and `label height + 2 × padding` down; 20 px a side is the target the guide gives (found by eye: enough to see whether the line is solid, dashed or dotted), and is the proposed default. It is a setting of the diagram (Diagram settings), stored in the `.chd`, so the app, `chd validate` and an assistant read the same value.
- **Two tiers.** *Hidden*: the label sits behind the elements, always checked (the check of 0162). *Tighter than your padding*: only checked when the diagram sets a padding, so existing files get no new warnings.
- **The second tier in the Layout section of Diagnostics.** The section exists for the first tier (done with 0162, using `hiddenLabels` from `src/shared/layout/`, [ADR 0147](../../decisions/0147-a-check-shared-with-the-skill-script-has-one-source-and-a-committed-copy.md)); this adds its rows.
- The layout guide gives the formula with the diagram's padding in place of the fixed 32 px.

## Questions to settle first
- **The field:** name, unit, default when absent (no second tier), a file-format entry in `docs/file-format.md`.
- **The app can measure the rendered label,** which is the real font. Showing that in the panel and the estimate on the command line would give two answers for one diagram; start with the same estimate in both.
- **The View menu's "Diagnostics (N)" count** does not include the layout rows: the check runs only while the panel is open. Whether to run it always, and what that costs on a large diagram.
- **A named font that is missing** on the computer is drawn in its fallback; the estimate cannot know which.

## Tasks
- [ ] Settle the field and write it into the schema, the format doc and the skill
- [ ] The second tier in `hiddenLabels`, with tests
- [ ] The padding control in Diagram settings
- [x] The Layout section in Diagnostics, with reveal, for the hidden tier (done with 0162); the second tier's rows are still to add
- [ ] ADR for the setting

## Notes
Raised while reviewing 0162: the figures in the guide are an estimate, and the person is the one who knows how airy they want the diagram.
