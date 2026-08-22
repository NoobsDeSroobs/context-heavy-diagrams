# 0041: Cancel epic 0048 (left tool sidebar) — reuse the existing floating-popup pattern instead

## Status
Accepted

## Context
Epic 0048 (left-side canvas tool sidebar) and epic 0049 (top menu bar) were raised together (2026-08-20), and [ADR 0039](0039-top-menu-bar.md) decided their combined information architecture before either was built: file-level actions to the new top menu, per-diagram view toggles (Highlights, Legend) to the future left sidebar. Only 0049 was built at the time. Separately, before 0049 even started, Highlights was moved out of the old top toolbar into its own floating popup next to Legend's existing one (`fix/highlights-free-tags-and-toggle`) — explicitly as an interim home, not the final one ADR 0039 had in mind.

With epic 0020 done and epic 0038 (drag-to-open) about to resume, the user reconsidered epic 0048 while deciding what to pick up next (2026-08-22).

## Decision
Cancel epic 0048 outright, not just deprioritize it. The floating-popup pattern Highlights and Legend already use is staying as their permanent home, not the interim placeholder ADR 0039 assumed it would be — there's no real problem it was solving that a dedicated sidebar would solve better. Building a new sidebar surface anyway, just to move two toggles that already work fine where they are, would be adding a second parallel affordance for the same kind of thing (a floating panel toggle) without a concrete need driving it.

This supersedes ADR 0039's left-sidebar half. ADR 0039's top-menu-bar half (File/Edit/View split, epic 0049) is unaffected.

## Alternatives considered
- **Build epic 0048 as originally scoped** (a dedicated `<Controls />`-adjacent sidebar, Highlights/Legend migrating there). Rejected — no longer has a real problem to solve now that the floating-popup pattern has been living happily as their permanent home rather than a stopgap.
- **Keep epic 0048 open but deprioritized**, in case a future feature needs a "real" sidebar surface. Rejected in favor of an outright cancel — nothing currently planned needs one, and an open-but-indefinitely-deferred epic just sits as backlog noise; it can always be re-raised fresh if a real need shows up later.

## Consequences
- [Epic 0048](../planning/epics/0048-left-tool-sidebar.md) marked Cancelled, not Not Started — removed from the App-features batch's remaining work.
- Any future panel-toggle-like feature (a hypothetical epic needing the same kind of "toggle a floating view") should default to the existing floating-popup pattern (`legendPanelAnchor`/`highlightsPanelAnchor` convention in `Canvas.tsx`) rather than assuming a sidebar is coming.
- The App-features batch's remaining work is now just [epic 0038](../planning/epics/0038-drag-file-to-open.md) (drag-to-open), resuming now that its own blocker (epic 0020) is done.
