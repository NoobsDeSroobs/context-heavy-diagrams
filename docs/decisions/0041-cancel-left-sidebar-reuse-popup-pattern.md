# 0041: Cancel the planned left tool sidebar — reuse the existing floating-popup pattern instead

## Status
Accepted

## Context
A left-side canvas tool sidebar and a top menu bar were raised together (2026-08-20), and [ADR 0039](0039-top-menu-bar.md) decided their combined information architecture before either was built: file-level actions to the new top menu, per-diagram view toggles (Highlights, Legend) to the future left sidebar. Only the menu bar was built at the time. Separately, before it even started, Highlights was moved out of the old top toolbar into its own floating popup next to Legend's existing one — explicitly as an interim home, not the final one ADR 0039 had in mind.

With dirty tracking done and drag-to-open about to resume, the user reconsidered the sidebar while deciding what to pick up next (2026-08-22).

## Decision
Cancel the left sidebar outright, not just deprioritize it. The floating-popup pattern Highlights and Legend already use is staying as their permanent home, not the interim placeholder ADR 0039 assumed it would be — there's no real problem it was solving that a dedicated sidebar would solve better. Building a new sidebar surface anyway, just to move two toggles that already work fine where they are, would be adding a second parallel affordance for the same kind of thing (a floating panel toggle) without a concrete need driving it.

This supersedes ADR 0039's left-sidebar half. ADR 0039's top-menu-bar half (the File/Edit/View split) is unaffected.

## Alternatives considered
- **Build the sidebar as originally scoped** (a dedicated `<Controls />`-adjacent sidebar, Highlights/Legend migrating there). Rejected — no longer has a real problem to solve now that the floating-popup pattern has been living happily as their permanent home rather than a stopgap.
- **Keep the sidebar planned but deprioritized**, in case a future feature needs a "real" sidebar surface. Rejected in favor of an outright cancel — nothing currently planned needs one, and an open-but-indefinitely-deferred item just sits as backlog noise; it can always be re-raised fresh if a real need shows up later.

## Consequences
- The left tool sidebar is cancelled, not just deferred — removed from the App-features batch's remaining work.
- Any future panel-toggle-like feature (something needing the same kind of "toggle a floating view") should default to the existing floating-popup pattern (`legendPanelAnchor`/`highlightsPanelAnchor` convention in `Canvas.tsx`) rather than assuming a sidebar is coming.
- The App-features batch's remaining work is now just drag-to-open, resuming now that its own blocker (dirty tracking) is done.
