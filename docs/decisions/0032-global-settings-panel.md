# 0032: A dedicated global Preferences panel, started now rather than deferred

## Status
Accepted

## Context
The forced-straight-edge-segment feature needed one global, rarely-changed number (how far an edge travels straight before curving) — described at the time as "an options/settings menu," but this app has never had one. The proposed shortcut was a small toolbar popup scoped to this one value, the same shell `ColorPickerPopup` already uses for a per-element color+opacity pair.

The user rejected that: this app is going to need a real Preferences surface for global, infrequently-changed preferences at some point regardless, and bolting a one-off popup onto the toolbar now would mean either replacing it later or accumulating several inconsistent one-off popups as more global settings show up (at least one more was already anticipated: an app-wide default for edge routing/waypoints would likely also want a global home). Better to build the real thing now, with this one setting as its first resident, than defer it until enough settings pile up to force the issue.

## Decision
A `PreferencesPanel` component, using the exact same shell this app already has for `RequiredTagsPanel`/`DiagnosticsPanel`/`HighlightsPanel`: rendered in `UtilityDock` (ADR 0013's fixed dock slot), toggled by its own toolbar button, mutually exclusive with the other four dock panels (opening any one closes the rest, same as today).

Persistence mirrors `theme.ts`'s existing pattern — the only precedent this app already had for a global, cross-window preference — but as one extensible object (`AppPreferences`) under a single `localStorage` key, not one key per setting the way `theme.ts` does for its single value. The next global setting just adds a field to `AppPreferences` and a row in `PreferencesPanel`; no new storage key, no new sync plumbing. Settings sync live across windows via the same `storage`-event listener `useTheme` already established.

Settings values reach edge/node rendering code through `DiagramContext`, the same way `matchHighlights` already does — components that need a setting read it via `useDiagramContext()`, not by receiving it as a prop threaded down manually.

## Alternatives considered
- **A toolbar popup scoped to this one setting** (the original proposal, `ColorPickerPopup`'s shell). Rejected by the user — it's the wrong shape for something meant to be a *global* app preference, not a contextual per-element editor, and doesn't leave room for more settings to land in the same place later.
- **Wait for a top menu bar and hang Settings off a future File/Edit/View/Help menu.** Rejected — the menu bar isn't built, isn't next in the current batch, and there's no reason this one setting should be blocked on unrelated, unscheduled work. If a menu bar lands later, it can add a menu item that opens the same `PreferencesPanel`; nothing here is incompatible with that.
- **One `localStorage` key per setting**, matching `theme.ts` literally. Rejected in favor of one extensible object — `theme.ts` only ever needed to store one value, so a dedicated key made sense for it; a panel meant to grow needs the pattern that stays cheap to extend, not the pattern that was convenient for a single field.

## Consequences
- Every future global-preference epic has a clear, established place to land: add a field to `AppPreferences` (`preferences.ts`), a row to `PreferencesPanel`, and (if a renderer needs it) a field on `DiagramContext` — not a new panel, popup, or storage mechanism.
- `PreferencesPanel` currently holds exactly one field. It'll look sparse until more settings arrive, which is expected and fine — the point was building the right shape now, not filling it immediately.
- If a top menu bar does land later, whoever builds it should open this same `PreferencesPanel` rather than building a second settings surface.

## Standing rule (added 2026-08-26): every `AppPreferences` field must always resolve to a real value

Adding a field to the `AppPreferences` interface with a `DEFAULT_PREFERENCES` entry is not sufficient on its own — every place a settings object is *received* (not just where it's first constructed) must also merge over `DEFAULT_PREFERENCES`, or an on-disk `settings.json` predating that field lands as `undefined` at the point of use. This surfaced as a real bug: the `isolateOpacity` field (added for Isolate mode) rendered as an empty input because the renderer's `usePreferences()` hook (`src/renderer/src/settings.ts`) trusted `window.api.readPreferences()` (main's IPC handler) to have already merged it, and the cross-window `preferences:changed` broadcast path had no merge at all — a sibling window just relays whatever it currently holds in memory. Both of `usePreferences()`'s `setSettings` call sites now re-merge over `DEFAULT_PREFERENCES` defensively, matching the same "absent means default" reasoning [ADR 0029](0029-backward-compatible-loading-is-a-standing-rule.md) already establishes for the `.chd` file format.

Same standard as ADR 0029, applied to `AppPreferences` instead of diagram files: **every future field added to `AppPreferences` must have a `DEFAULT_PREFERENCES` entry, and must never be read as though it's guaranteed present without a merge-over-defaults somewhere between disk/IPC and the component that renders it.** Check `usePreferences()`'s two `setSettings` calls (initial load, cross-window broadcast) still do this whenever touching that file.
