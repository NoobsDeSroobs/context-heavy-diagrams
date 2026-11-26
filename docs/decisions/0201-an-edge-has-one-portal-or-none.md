# 0201: An edge has one portal, or none

## Status
Accepted (2026-11-26). Builds on [ADR 0200](0200-portal-ends-are-matched-by-a-number-and-drawn-as-a-tilde-or-an-oval.md). The stored field's exact shape and how a gap follows a moved element are not decided here.

## Context
A portal hides a stretch of an edge so it need not be drawn across what lies between. On straight edges the stretch that skips one crossing is short, but on step and curved edges the crossings pile up along an edge, and skipping them takes a longer gap. An edge could instead carry a gap for each crossing.

## Decision
1. **An edge has at most one portal:** one gap, two ends, one number. No portal means a whole edge.
2. **A longer gap is the answer to many crossings.** Skipping five edges is one bigger gap, and the person sets the two ends along the edge (a slider for each, a drag handle for each on the canvas).
3. **The gap is stored as an optional pair of positions along the edge's path** on the edge itself, measured from the source, so one additive field holds it.

## Alternatives considered
- **A gap for each crossing.** Several small gaps per edge, each with its own pair of marks and number. It keeps each hidden stretch short, but a person has to place and read many portals on one edge, the field becomes a list, and the numbers multiply. Rejected for the first version.
- **A gap cut automatically from every crossing.** Rejected: the person decides what is worth hiding.

## Consequences
- An edge that crosses things in two separate places gets one gap long enough to cover both, or one of the two crossings stays drawn.
- Several portals on one edge can be added later as a list without breaking a file that holds one.
