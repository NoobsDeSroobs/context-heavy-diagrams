# 0146: Elements joined by an edge keep a gap for the label

## Status
Accepted (2026-11-05).

## Context
The layout guide gave two rules that contradict each other: closely related elements go 20 px apart, and an edge label needs 100 to 160 px of room. Two elements joined by a labelled edge at 20 px leave no room for the label, which is drawn behind both of them, and an assistant that follows the shorter rule produces exactly that. There is no automatic layout, so the assistant's placement is the layout.

## Decision
- **Elements joined by an edge keep a connection gap, measured edge to edge along the direction the edge mostly runs.** The baseline and loose gaps are for elements that are not joined by an edge. An edge between a container and an element inside it is not covered.
- **The gap comes from the label's chip:** at the edge's label position (the middle by default), as wide as its text plus 14 px and as high as its lines plus 4 px (the chip the canvas and the export draw), with line and end graphic showing on each side. The target is about 20 px a side, enough to see whether the line is solid, dashed or dotted. In the default 12 px font that is about `6.5 × characters + 50` px for a horizontal edge (40 px with no label; 6.5 px is a lowercase letter) and `19.2 × lines + 44` px (63 px for one line) for a vertical one.
- **The text is measured character by character, in the label's font,** with the estimate the SVG export already wraps text with ([ADR 0124](0124-svg-export-from-a-shared-pure-renderer.md)): a sans-serif's proportions, bold wider, monospace 0.6 em, capitals and CJK or emoji wider, scaled by the font size. The font is the edge's own `fontFamily` and `fontWeight`, else the diagram's `fontFamily` ([ADR 0130](0130-diagram-default-font-and-installed-fonts.md)). The computer's own font is not read: a command-line check has no font to read and the app ships none, so a measured width would differ between the person's computer and a CI machine.
- **The validator warns, never errors, where the label does not fit with the edge still readable.** Centred, the gap must hold the chip plus, on each side, the line the larger end graphic needs: 12 px for an arrow, 8 for none, 5 for a crow's foot "one" up to 18 for "zero or many" (a table in `labelClearance.ts`). A label slid towards one end is judged side by side: the nearer side needs 3 px to keep it off the element, the farther one its graphic's line. The target above is guidance; the warning is the minimum. Every figure was set by eye in the app, from the smallest gap that looked acceptable with each graphic at both ends of a labelled edge, in six fonts and sizes and one three-line label: a chip that merely fits between the elements, with no line showing, is not enough.
- **The warning leaves out what it cannot judge:** an edge with bend points (the chip is not along the gap), a label position outside the edge, a text-only line, an edge between a container and its own content, overlapping elements, and an edge that leaves by the far side of an element (it loops round, so the label is not in the gap). Handles that are connection points count as facing.
- **Diagnostics lists the same edges** in a Layout section while the panel is open: the label, the two elements, the room and the need, and a click selects the edge and frames the two elements. The panel measures in the diagram's font, else the personal default from Preferences, which the file does not store, so for a diagram with no font of its own the panel can differ from `chd validate`.
- **One implementation,** `src/shared/layout/labelClearance.ts`. The skill's script, which `chd validate` and the extension's `validate_diagram` share, runs a generated copy of it ([ADR 0147](0147-a-check-shared-with-the-skill-script-has-one-source-and-a-committed-copy.md)).

## Alternatives considered
- **Measure the text in the app.** Exact for one machine's font, but the font stack differs per system and a validator has no renderer.
- **Warn at the guide's full figure.** About one edge in five in the shipped examples would warn, which makes the warning noise.
- **An error.** The figures are an estimate, and a diagram with a tight gap is still a valid diagram.
- **Read the font's own widths.** Exact for one computer, but it needs a font parser and the font file. A generic family is a different font on each computer, a named font may be missing, and a check would give the person and a CI machine different answers.
- **Wait for automatic layout.** An assistant draws diagrams now.

## Consequences
- A warning can be wrong for an unusual font; it says what it assumed, and the guide says so.
- Some shipped gallery diagrams have labels wider than their gaps and now warn until their layouts are loosened.
