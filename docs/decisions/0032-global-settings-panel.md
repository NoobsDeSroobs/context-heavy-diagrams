# 0032: A dedicated global Settings panel, started now rather than deferred

## Status
Accepted

## Context
[Epic 0047](../planning/epics/0047-edge-forced-straight-segment.md) needed one global, rarely-changed number (how far an edge travels straight before curving) — the epic's own doc called this "an options/settings menu," but this app has never had one. The proposed shortcut was a small toolbar popup scoped to this one value, the same shell `ColorPickerPopup` already uses for a per-element color+opacity pair.

The user rejected that: this app is going to need a real Settings surface for global, infrequently-changed preferences at some point regardless of this epic, and bolting a one-off popup onto the toolbar now would mean either replacing it later or accumulating several inconsistent one-off popups as more global settings show up (this epic's own doc already anticipates at least one more: an app-wide default for [epic 0032](../planning/epics/0032-edge-routing-and-waypoints.md)'s waypoint mechanism would likely also want a global home). Better to build the real thing now, with epic 0047's one setting as its first resident, than defer it until enough settings pile up to force the issue.

## Decision
A `SettingsPanel` component, using the exact same shell this app already has for `RequiredTagsPanel`/`DiagnosticsPanel`/`HighlightsPanel`: rendered in `UtilityDock` (ADR 0013's fixed dock slot), toggled by its own toolbar button, mutually exclusive with the other four dock panels (opening any one closes the rest, same as today).

Persistence mirrors `theme.ts`'s existing pattern — the only precedent this app already had for a global, cross-window preference — but as one extensible object (`AppSettings`) under a single `localStorage` key, not one key per setting the way `theme.ts` does for its single value. The next global setting just adds a field to `AppSettings` and a row in `SettingsPanel`; no new storage key, no new sync plumbing. Settings sync live across windows via the same `storage`-event listener `useTheme` already established.

Settings values reach edge/node rendering code through `DiagramContext`, the same way `matchHighlights` already does — components that need a setting read it via `useDiagramContext()`, not by receiving it as a prop threaded down manually.

## Alternatives considered
- **A toolbar popup scoped to this one setting** (the original proposal, `ColorPickerPopup`'s shell). Rejected by the user — it's the wrong shape for something meant to be a *global* app preference, not a contextual per-element editor, and doesn't leave room for more settings to land in the same place later.
- **Wait for [epic 0049](../planning/epics/0049-top-menu-bar.md)'s top menu bar and hang Settings off a future File/Edit/View/Help menu.** Rejected — 0049 isn't built, isn't next in the current batch, and there's no reason this epic's one setting should be blocked on an unrelated, unscheduled epic. If 0049 lands later, it can add a menu item that opens the same `SettingsPanel`; nothing here is incompatible with that.
- **One `localStorage` key per setting**, matching `theme.ts` literally. Rejected in favor of one extensible object — `theme.ts` only ever needed to store one value, so a dedicated key made sense for it; a panel meant to grow needs the pattern that stays cheap to extend, not the pattern that was convenient for a single field.

## Consequences
- Every future global-preference epic has a clear, established place to land: add a field to `AppSettings` (`settings.ts`), a row to `SettingsPanel`, and (if a renderer needs it) a field on `DiagramContext` — not a new panel, popup, or storage mechanism.
- `SettingsPanel` currently holds exactly one field. It'll look sparse until more settings arrive, which is expected and fine — the point was building the right shape now, not filling it immediately.
- If epic 0049's top menu bar does land later, whoever builds it should open this same `SettingsPanel` rather than building a second settings surface.
