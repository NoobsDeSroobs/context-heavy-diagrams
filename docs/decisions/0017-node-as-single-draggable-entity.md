# 0017: A node is a single draggable entity — details and links are data, not objects

## Status
Accepted

## Context
The project brief was written after the author tried multiple existing diagramming tools and found they all fail in at least one of three specific ways: requiring multiple overlapping objects to be moved together manually, arrows not dynamically re-routing when connected shapes move, and grouping mechanisms that make it hard to edit individual elements independently afterward. This is a foundational interaction principle stated up front in the brief, before any feature work began — every later feature that attaches extra content to a node (details, linked diagrams, icons, connection points) has been quietly built on top of it, but it was never itself recorded as a decision.

## Decision
**A node is a single draggable entity.** Detail content and linked-diagram references are **data fields on that node**, never separate canvas objects — no second overlapping element to keep in sync, select, or accidentally leave behind when the node moves. Edges are always logically bound to node connection points and re-route automatically on move/resize; never manually redrawn or left stale. Click semantics follow directly from this: plain click selects, plain drag moves, right-click opens the details panel (a rendering of node data, not a navigation to another object), Ctrl/Cmd+click navigates a link (again, following data on the node, not clicking a second object).

## Alternatives considered
- **Details/links as separate, positioned canvas objects** (e.g. a small note/badge node placed near its parent shape): this is essentially what the brief's failure-mode list is describing and rejecting — the explicit prior experience was that such setups require manual re-positioning together, break when only one half moves, and make independent editing harder. Not seriously entertained as a real option given that lived experience.
- **A generic "attachment" or "annotation" node type**, connected to its parent via a special non-diagrammatic edge: rejected for the same reason — it's still two objects with a relationship to maintain, just with the relationship formalized as an edge instead of manual positioning. Doesn't remove the underlying failure mode, just relabels it.

## Consequences
- Every "attach more to a node" feature since has defaulted to "add a field to `data`," not "add a new node type or a linking mechanism" — details (`data.details`, a relative path to a `.md` file), icons (`data.icons`), linked diagrams (`data.linkedDiagram`) all follow this shape directly.
- Interacts with, but is distinct from, [ADR 0015](0015-anchor-placeholder-node.md)'s `AnchorNode`: that *is* a real, separate node — used specifically because an edge's endpoint has no other valid representation in React Flow's data model (see that ADR), not because this principle was relaxed. An anchor is still a first-class draggable entity in its own right, never a passive decoration hanging off another node.
- Rules out, by design, any future feature that would reintroduce a "move this too" burden — e.g. a floating, independently-positioned label was explicitly considered and rejected for exactly this reason (see [ADR 0020](0020-labels-always-centered.md)).
