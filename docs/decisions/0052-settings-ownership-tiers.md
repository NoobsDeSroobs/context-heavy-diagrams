# 0052: Settings ownership tiers, and a diagram-override/user-default/built-in-default fallback pattern

## Status
Decided (2026-08-23)

## Context
Mid-implementation of the move of `AppPreferences` off `localStorage` onto a real per-OS file, the user paused to ask a more fundamental question: this app has at least three different things people were all calling "settings" — a shape's own style, a diagram's highlight catalog, and the app's own global preferences — with no agreed vocabulary distinguishing them, and a handful of existing values (the style palette, gravity presets, max connection points per side) that don't obviously belong to just one of those. Continuing that storage migration without settling this risked reshaping `AppPreferences` twice in quick succession: once for the storage mechanism, once again shortly after for whichever of these three turned out to need a different shape.

## Decision

**1. Three ownership tiers, plus a non-tier for pure views.** See [the glossary](../architecture/glossary.md) for the full definitions. (The two middle tiers were originally named "Configuration" and "Settings"; see the 2026-08-27 addendum for the rename to the names below.)
- **Properties** — per-element (a shape's style, an element's metadata/tags). Already this codebase's own term (`PropertyPanel.tsx`).
- **Diagram settings** — per-diagram, stored in `DiagramFile` outside `nodes`/`edges` (`requiredTags`, `highlights`, `legend`, `gravityPresets`, `maxConnectionPointsPerSide`, `metadata`, `viewport`).
- **Preferences** — per-installation, across every diagram (`AppPreferences`).
- **Views** (Diagnostics, Layers) — not a tier at all; read-only/derived inspection tools with no owned state, called out so they aren't miscategorized.

**2. A three-step fallback pattern — Diagram override → User default → Built-in default — for the specific values where personal-preference-most-of-the-time collides with collaboration-needs-consistency-sometimes.** Applied to:
- **Max connection points per side**: becomes a genuine constraint on what a diagram *can* contain (how many connection points an element may have), not just a display preference. Two collaborators with different personal limits could produce a diagram one of them can't fully edit — a real correctness problem, not a convenience one. Moves to a Diagram override (new `DiagramFile` field) falling back to the existing Preferences value as the User default. Tracked as its own follow-up ([ADR 0067](0067-max-connection-points-diagram-override.md)).
- **Gravity presets**: already has a Diagram override (`DiagramFile.gravityPresets`) and a Built-in default (`DEFAULT_GRAVITY_PRESETS`, [ADR 0050](0050-freeform-line-as-node-type.md)) — but no User default in between, so there's currently no way to set your own default preset list across diagrams that don't override it. Tracked as its own follow-up ([ADR 0066](0066-gravity-presets-user-default.md)).

**3. The style palette gets no Diagram override tier at all — Preferences only.** Rejected specifically because it would be redundant: a shape's actual fill/font is already a concrete stored value at the Properties level (same reasoning [ADR 0050](0050-freeform-line-as-node-type.md) already established for gravity values — the catalog only affects what's *offered* while authoring, never what's rendered). Someone who just wants to view a diagram or use its highlights/hierarchy features doesn't need palette access at all; someone who wants to edit and match the diagram's existing conventions can already be handed a real palette file directly (`stylePalette:exportToFile`/`importFromFile`, [ADR 0048](0048-style-palette-and-defaults.md) — this already exists, nothing new needed there). What *is* new: supporting several named palettes at the Preferences level with an active-palette selector (e.g. "Company," "GDPR," "Client"), rather than today's one-palette-replaced-on-import. Tracked as its own follow-up ([ADR 0068](0068-multiple-named-style-palettes.md)).

## Alternatives considered

**Giving the style palette a diagram-local copy of colors/fonts** (an earlier version of this decision, floated before the "it's redundant with Properties" reasoning above was worked through) — rejected once it became clear the color/font information already travels with the diagram via each element's own stored style; a copy would only ever go stale or need active syncing for zero rendering benefit.

**Renaming Settings to "Preferences"** to read more distinctly from "Configuration" — rejected *here* as pure churn (`SettingsPanel`, `AppSettings`, menu labels, IPC channel names all said "settings" already) for a marginal clarity gain the glossary already provides in writing. **Reversed later** (2026-08-27, see the addendum below): the glossary distinction turned out not to reach a user reading the View menu, and the user chose to accept the churn once, moving glossary + code + UI together.

## Consequences
- No change to the storage-migration work itself — the fallback-pattern additions (gravity-preset and max-connection-point User defaults) and the multi-palette feature are new, separately-scoped follow-ups, not folded into that migration. `AppPreferences`'s shape stays whatever it is today for the purposes of that migration; these three land as follow-up changes to that same (now-relocated) file afterward.
- [docs/architecture/glossary.md](../architecture/glossary.md) is the new canonical reference for these terms — use it, not ad hoc phrasing, in future epics/ADRs that touch any of these three tiers.

## Addendum (2026-08-27): the per-diagram/per-app tier terms renamed

While consolidating the diagram-level panels ([ADR 0071](0071-consolidate-diagram-configuration-panel.md)), the user's own observation: "Diagram configuration" and "Settings" sitting next to each other in the View menu signal nothing about the tier difference to anyone who hasn't read the glossary. A scope prefix does: **Configuration → "Diagram settings"**, **Settings → "Preferences"** (the conventional app-wide term).

This is the "Preferences" rename this ADR rejected above — accepted, deliberately, because the earlier "the glossary already provides the clarity in writing" reasoning doesn't hold for a user who never reads the glossary. The user's condition: glossary + code identifiers + UI all move together, so nothing ends up out of sync.

**Done** the same day (2026-08-28), an ~40-file mechanical sweep alongside ADR 0071's panel consolidation:
- `AppSettings` → `AppPreferences`, `DEFAULT_SETTINGS` → `DEFAULT_PREFERENCES`, `useSettings` → `usePreferences` (returning `{ preferences, updatePreferences }`), `SettingsPanel` → `PreferencesPanel`, `DiagramConfigPanel` → `DiagramSettingsPanel`, and the panel-open state/toggles.
- Files: `shared/settings.ts` → `preferences.ts`, `main/appSettings.ts` → `appPreferences.ts`, `renderer/settings.ts` → `preferences.ts`, plus the two component renames.
- IPC channels `settings:{read,write,changed}` → `preferences:*`.
- CSS `.settings-panel*` → `.preferences-panel*`, `.diagram-config-*` → `.diagram-settings-*`.
- Glossary tier headings; UI menu labels and panel titles; every "your Settings default"-style string.
- **Not renamed:** the on-disk `settings.json` filename (invisible to users, and renaming it would need a migration for no real benefit); the pre-ADR-0053 `localStorage` key `'settings'` (read once, for migration only).
