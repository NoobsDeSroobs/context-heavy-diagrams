# 0200: Portal ends are matched by a number, never by colour, and drawn as a tilde or an oval by preference

## Status
Accepted (2026-11-26). The rest of the portal design (the stored field, where the gap goes) is not decided here.

## Context
A portal breaks an edge into two visible parts with a mark at each end, so the person has to see which two marks belong together. Colour already carries meaning on an edge (a legend line is a colour), and a pair's colour is lost in grayscale, in print and for colour-blind readers. Two marks were tried on a real diagram: a tilde (a curved S) turned across the edge, like the break in a line, and an oval across the edge, drawn over the edge at the entry and under it at the exit, so the line goes into the one and comes out of the other. People read them differently; neither won.

## Decision
1. **A number matches the two ends of a portal. Colour does not encode the pair.** All portals use one colour, the same for every pair, so the number is the only key. The number sits beside the mark on the side of the gap.
2. **Both marks are offered, and which one is drawn is a per-person preference** in the app's Preferences, so each person sees portals the way they read them best. The tilde and the oval carry the same information: the same number, the same position.
3. **The preference is not stored in the diagram.** It changes only how a portal is drawn; the diagram holds the portal and its number, never the mark.

## Alternatives considered
- **One colour per pair, with the number.** Rejected: it competes with the colours edges already use, and several pairs near one another need as many distinguishable colours.
- **A single mark.** Rejected: neither mark read best for everyone.
- **The mark as a property of the diagram.** Rejected: it is how one person likes to read, and two people open the same file.

## Consequences
- Every place that draws a portal reads the preference, and the preference has to be merged over its default wherever it is received, like the other preferences.
- What an exported picture (SVG, PNG) draws, and what the review window draws, is settled with the drawing code: the review window cannot write a preference ([ADR 0112](0112-electron-hardening-sandbox-and-navigation.md)).
