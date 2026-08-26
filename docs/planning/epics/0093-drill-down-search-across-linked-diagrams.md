# 0093: Drill-down search across linked diagrams

## Status
Not Started — logged only, not scoped.

## Goal
Extend [epic 0062](0062-search-and-highlight-matches.md)'s search to optionally reach into linked child diagrams (epic 0009's linked-diagram navigation), not just the currently-open one — useful when a diagram tree is large or not well-maintained enough for the user to already know where something lives.

## Scope notes (from the design conversation that spun this off, 2026-08-26)
- Must be an explicit toggle, off by default — never silently searches beyond the current diagram.
- **Excludes details-sublayer deep search.** The user's reasoning: information relevant enough to matter in V1 should already live directly in the details panel or the diagram itself, not require a cross-file deep scan to surface. Drill-down search is for locating *elements*, not for grepping their notes across the tree.
- Real cost: requires loading and parsing sibling/child `diagram.json` files that aren't currently open, not just querying in-memory state — a genuinely harder feature than epic 0062's single-diagram case, hence the separate epic rather than folding it in.

## Notes
Logged 2026-08-26, during epic 0062's design pass, at the user's explicit instruction to create this as its own epic rather than leave it as a Notes aside.
