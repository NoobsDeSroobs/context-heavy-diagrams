# 0196: New edges follow a line of the diagram's legend

## Status
Accepted. Supersedes in part [0045](0045-default-edge-style-setting.md): the personal default stays, as the fallback.

## Context
The button at the top chooses the style of new edges from seven built-in presets and keeps the choice as one personal setting for every diagram ([0045](0045-default-edge-style-setting.md)). A diagram's legend already holds named line entries (colour, line style, markers) that the author says mean something ([0033](0033-diagram-legend-design.md)), yet a new edge is "a dashed arrow", never "Data flow".

## Decision
- **One `line` entry of the legend can be marked `forNewEdges: true`.** New edges are drawn with that line. The mark is a field of the entry, not a second pointer in the file, so there is no id that can dangle, deleting the entry ends it, and the compare view, the CLI and the validator already read entries. At most one entry has it: marking one clears the others, and a hand-written file with two uses the first. An entry of another kind that has it is ignored.
- **The picker lists the diagram's lines first.** The edge-style button opens the same picker as before, with the diagram's line entries on top (the one in use is ticked, and picking it again stops using it) and the presets below, headed "for every diagram". Picking a preset sets the personal default and clears the mark, so there is never a question of which one applies.
- **Precedence:** the active direction set's own style ([0083](0083-per-set-edge-style-as-creation-template.md)) over the marked line over the personal default. The marked line replaces the personal default as a whole: it does not overlay it, so a personal width or colour cannot change what the legend says.
- **What an edge gets:** line style, start and end marker, colour and the motion fields (animation, speed, direction, pulse, dash), the fields an entry has. Width and opacity are not in an entry ([0123](0123-legend-line-picked-from-an-edge.md)), so they stay unset and the built-in values fill them in. A field the entry leaves out is left out.
- **The colour** is the one the legend shows in the theme in use, stored the way an edge stores a colour, as the reverse of [0123](0123-legend-line-picked-from-an-edge.md). An edge a person draws in the light theme therefore looks like the legend row there; an edge written by an assistant stores the legend's colour as it is, which is what the dark theme shows.
- **Only new edges.** Changing the marked entry afterwards does not restyle edges already drawn; the legend is the author's statement, the edges keep their own style.
- **The assistants:** `set_new_edge_line {id}` marks a line (null for none), and `connect` without a `style` uses it, so an assistant's new edges mean the same as a person's. The validator warns about a mark on an entry that is not a line and about two marks.
- **Format:** an additive field of a legend entry, a MINOR bump; an older app ignores it. `docs/file-format.md` changes with it.

## Alternatives considered
- **An id at the top of the file** (`defaultLine`), like the diagram font. Needs a new argument through every place that builds the file, can dangle, and needs its own handling in compare and the tools, for what a flag on the entry gives for free.
- **Overlay the line on the personal default.** A personal width or colour would leak into what the legend says a line is.
- **A preset picked in the button adds a legend entry.** A legend row, in the legend and its exports, for every style someone tried. The legend panel already adds lines from presets or from an edge, deliberately.
- **Restyle existing edges when the entry changes.** Rejected for the reason in [0010](0010-named-searchable-style-presets.md): nothing remembers where a style came from.

## Consequences
- `LegendEntry.forNewEdges`, `src/shared/legend/newEdgeLine.ts`, the picker's new sections, and the toolbar swatch and tooltip showing the line in use.
- Light-theme edges drawn by an assistant from a coloured legend line can look different from its legend row, the known gap of a legend colour that is never flipped for the theme.
