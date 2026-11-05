# 0146: Elements joined by an edge keep a gap for the label

## Status
Accepted (2026-11-05).

## Context
The layout guide gave two rules that contradict each other: closely related elements go 20 px apart, and an edge label needs 100 to 160 px of room. Two elements joined by a labelled edge at 20 px leave no room for the label, which is drawn behind both of them, and an assistant that follows the shorter rule produces exactly that. There is no automatic layout, so the assistant's placement is the layout.

## Decision
- **Elements joined by an edge keep a connection gap, measured edge to edge along the direction the edge mostly runs.** The baseline and loose gaps are for elements that are not joined by an edge. An edge between a container and an element inside it is not covered.
- **The gap comes from the label's own styling,** not from a measurement of each font: a chip centred on the edge's midpoint, about 23 px tall, as wide as its text plus 14 px, with the text taken as 6.5 px a character at the default 12 px (scaled with the font size), and 16 px of visible line on each side. That gives `6.5 × characters + 46` px for a horizontal edge (40 px with no label) and 55 px for a vertical one, whatever the label.
- **The validator warns, never errors, where the label certainly does not fit:** the gap is smaller than the chip itself, without the visible line. The stricter figure is guidance; the warning is the minimum.
- **The warning leaves out what it cannot judge:** an edge with bend points or a moved label (the chip is not in the middle of the gap), a text-only line, an edge between a container and its own content, overlapping elements, and an edge that leaves by the far side of an element (it loops round, so the label is not in the gap). Handles that are connection points count as facing.
- **One implementation:** the check lives in the validation script of the skill, which `chd validate` and the Claude Desktop extension's `validate_diagram` already share.

## Alternatives considered
- **Measure the text in the app.** Exact for one machine's font, but the font stack differs per system and a validator has no renderer.
- **Warn at the guide's full figure.** One edge in five in the shipped examples would warn, which makes the warning noise.
- **An error.** The figures are an estimate, and a diagram with a tight gap is still a valid diagram.
- **Wait for automatic layout.** An assistant draws diagrams now.

## Consequences
- A warning can be wrong for an unusual font; it says what it assumed, and the guide says so.
- Some shipped gallery diagrams have labels wider than their gaps and now warn until their layouts are loosened.
