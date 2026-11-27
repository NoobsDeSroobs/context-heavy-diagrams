# 0033: A diagram must be legible without its author, so the legend travels with it

## Status
Accepted. Reformulated 2026-11-26 as the principle behind the original design.
Supersedes: none
Superseded by: none

## Context
Colour, line style and icons carry meaning, and nothing in the picture explains the convention. A reader who was not in the room, or the author a year later, has to guess.

## Decision
**A diagram should be legible without its author present. A legend is therefore part of the diagram:** how to read it is embedded in the diagram itself, saved in the file, and not left in someone's head or in a separate document.

What follows from it:
- **The legend is authored, never derived.** An entry such as "dashed = planned data flow" often has no metadata behind it, so the legend is not generated from the highlights, and the two catalogs stay independent.
- **The catalog is saved with the diagram; whether its panel is open is not.** Opening it is session-only, like every other panel.
- **An entry is one flat type of three kinds:** a line (a line style with its markers), an icon, or an entity, which is a colour. A colour is drawn as a circle, never a box, so it reads "this colour means X" and not "only boxes mean X".
- **It sits beside the canvas controls,** not in the side dock with the panels that manage the diagram, because it belongs to reading the picture.

## Alternatives considered
- **Fill the legend from the highlights.** It could not express a line style or any convention without metadata behind it.
- **A coloured box for a colour entry.** It suggests the convention applies only to rectangles.

## Consequences
- The legend is part of the file format ([docs/file-format.md](../file-format.md)) and of every export of the diagram.
