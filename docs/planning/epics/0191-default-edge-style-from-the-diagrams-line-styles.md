# 0191: The default edge style is picked from the diagram's own line styles

## Status
Built on the branch `chore/version-0.15.0-and-epic-cleanup`. Logged 2026-11-16, from using the app; decided 2026-11-21 ([ADR 0196](../../decisions/0196-new-edges-follow-a-line-of-the-diagrams-legend.md)).

## Goal
Make the edge-style button at the top useful: pick the style of new edges from the line styles the diagram already uses (its legend's line entries), and add a new one from the same place, instead of choosing from seven built-in presets.

## What exists
- The button opens `StylePicker` with the built-in line presets (plain, dashed, dotted, arrow, open arrow, dashed arrow, double arrow) and stores the choice as `AppPreferences.defaultEdgeStyle`, one setting for every diagram ([ADR 0045](../../decisions/0045-default-edge-style-setting.md)).
- A diagram's legend holds named line entries (colour, line style, markers) that the diagram's author asserts mean something ([ADR 0033](../../decisions/0033-diagram-legend-design.md)); an edge on the canvas can pick one ([ADR 0123](../../decisions/0123-legend-line-picked-from-an-edge.md)).
- A direction set can carry a creation-template style for new edges ([ADR 0083](../../decisions/0083-per-set-edge-style-as-creation-template.md)).

## Idea
The picker lists the diagram's line entries by name, with a way to add one (the preset list becomes the starting choices of "add"). The chosen entry is the style new edges are drawn with. A new edge then means something from the moment it is drawn (it is "Data flow", not "a dashed arrow"), which is what the legend is for.

## Open questions
- **Where the choice lives.** Today the default is global; the entries are per diagram. Probably the diagram stores which entry is the default for its new edges, so opening another diagram does not give its edges this one's style. Does a global fallback stay for a diagram with no entries?
- **A legend entry has no width or opacity** (by design, [ADR 0123](../../decisions/0123-legend-line-picked-from-an-edge.md)), while `defaultEdgeStyle` is a full `EdgeStyle`. Either the entry gains them, or a default taken from an entry has only what an entry has.
- **Every entry is a legend row.** An entry added only to hold a style would show in the legend and in the exports. Does an entry need an "in the legend" switch, or is a style that is not worth a legend row not worth naming?
- **Precedence with direction sets.** A set's creation template and the default entry can both apply to a new edge; the set should win, as it is the narrower.
- **An empty diagram** has no entries: the picker opens on the built-in presets, and picking one adds it as an entry.
- **A file-format change** (which entry is the default) is additive; `docs/file-format.md`, the compare view and the assistant tools follow.

## Tasks
- [x] Design pass on the questions above; an ADR that supersedes the preference in [0045](../../decisions/0045-default-edge-style-setting.md) in part ([0196](../../decisions/0196-new-edges-follow-a-line-of-the-diagrams-legend.md)).
- [x] The picker with the diagram's lines first, the mark on a legend entry, the toolbar swatch. The personal `defaultEdgeStyle` stays as the fallback, so nothing is migrated.
- [x] The file format, the validator and the tools (`set_new_edge_line`, `connect`).
- [ ] Follow-ups: the compare view does not show a change of the mark (the legend list compares entries by id), and the legend panel does not mark the row.
- [x] An example (`examples/new-edge-line.chd`) and the changelog.
- [x] From trying it: the legend line carries a thickness, the arrowhead tip is no longer blunted by a thick line, and the picker previews each line as it looks ([ADR 0197](../../decisions/0197-pointed-arrowheads-keep-their-tip-and-lines-carry-a-thickness.md)).
