# 0031: Connection-aware alignment

## Status
Not Started — not yet scoped. Split out of [epic 0011](0011-alignment-and-snapping.md) when that epic started: its task list flagged this specific idea as genuinely undecided between two very different scopes, not a small addition to fold into shape-to-shape snapping. Decided with the user: keep 0011 scoped to drag-time visual guides + snap-to-shape, defer this here.

## Goal
Position a node relative to what it's connected to — e.g. a node with one incoming/outgoing edge could align on the same axis as its connected neighbor, rather than sitting wherever it happened to land. Raised as a quality-of-life idea for diagrams that grow more complex and edge-heavy over time.

## The real fork (not resolved here)
Two fundamentally different features could satisfy this goal:
- **Lightweight extension of epic 0011's snap system**: treat "the node(s) this one is connected to" as just another alignment source alongside "nearby shapes," using the same drag-time guide/snap mechanism (`src/renderer/src/alignment.ts`, `computeSnap`). Small, incremental, consistent with 0011's own mechanism.
- **Real auto-layout**: pull in a graph layout algorithm (e.g. dagre, elk) that repositions nodes based on the whole connection graph, likely a "tidy up" / "auto-arrange" action rather than a drag-time behavior at all. A much bigger, different feature — different UI (a button/command, not a drag interaction), different mental model (the tool arranges things for you vs. the tool nudges what you're already doing), and a new dependency.

Which one (or both, or neither) is actually wanted needs real diagram-building experience to inform — not something to guess at now.

## Notes
No target position in the epic sequence — flagged so it isn't lost, not because it's next up. See [PROGRESS.md](../../../PROGRESS.md) for what's actually scheduled.
