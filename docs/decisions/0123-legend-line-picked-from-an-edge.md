# 0123: A legend line is copied from an edge on the canvas

## Status
Accepted (2026-10-20).

## Context

Adding a legend entry for an edge convention meant rebuilding the look by hand: choose a named line-style preset in `StylePicker`, then a colour, even though the diagram already holds an edge that looks exactly like the one being explained ([ADR 0033](0033-diagram-legend-design.md)). The preset list does not contain the author's own combinations, so the entry rarely matched the edge it described. Colours and icons did not have this problem: a colour is one value, and an icon is picked from the same library the entities use.

## Decision

**Choosing "Line" in the Legend panel's add flow waits for a click on an edge, and copies that edge's look.** Icon and Color work as before.

- **While waiting**, the cursor over edges is a crosshair and over nodes not-allowed. The toolbar and the panel both say what to do, and **Esc** or a Cancel button ends it, back to where "Add legend entry" started. Clicking anything that is not an edge does nothing, and so does Ctrl/Cmd/Shift+click (follow a link, edit the selection), as for the style brush ([ADR 0095](0095-copy-style-apply-mode.md)). The pick takes the click before an active style brush, so the edge being picked is never painted.
- **A pick opens the usual draft form**, pre-filled and with a preview of the line, so the label is typed and the colour can still be changed before the entry is added. Nothing is written to the legend until then.
- **What is copied:** line style, start marker, end marker and colour, the fields a `line` entry has. Width and opacity have no legend field and are not copied.
- **Defaults are written out.** An unset line style or marker on the edge becomes the built-in value from the style defaults ([ADR 0117](0117-built-in-style-defaults-are-data.md)), because the entry has no other way to know what "unset" meant. An explicit "none" marker stays "none".
- **The colour is the one shown now, not the stored one.** A stored edge colour is the dark-theme baseline and is flipped for display ([ADR 0034](0034-theme-adaptive-color-value-flip.md)), but a legend colour is drawn as stored and never flipped, so copying the stored value would show a different colour in light mode. An edge with no colour of its own leaves the entry's colour unset, which the legend already draws in the default edge colour of whichever theme is active.
- **The preset picker stays** as "Choose a preset…" while waiting, for a diagram with no edge to copy from yet.
- **No schema change.** `LegendEntry` is unchanged and so is `docs/file-format.md`.

## Alternatives considered

- **A picker for every kind, switched by a mode (colour, line, icon).** An entity has a fill, a stroke, a font colour and up to four icons, so "the trait under the pointer" is ambiguous for anything but an edge, and the manual colour and icon pickers already work. Only the line, where rebuilding the look is the real problem, gets one.
- **Copy the stored colour and make the legend flip it.** Consistent in both themes, but it changes how every existing legend entry looks in light mode and runs into the light-mode round-trip bug in the known-issues log.
- **Replace the preset picker.** Rejected: with no edge drawn yet there would be no way to start a line entry.
- **Copy the width as well.** There is no legend field for it, and adding one is a file-format change for little gain: a legend swatch is a fixed 2 px line so that dashes stay readable.

## Consequences

- An entry copied in one theme keeps that theme's colour in the other, as a colour typed into the legend always has. Only an edge with no colour of its own adapts.
- Clicking an edge to pick it also selects it, as any click does; the selection is left alone, as with the style brush.
- The edge's colour at the time of the click is what is copied. A highlight that is recolouring the edge is not (the stored style is), as for the style brush.
