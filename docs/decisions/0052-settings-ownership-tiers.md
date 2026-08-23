# 0052: Settings ownership tiers, and a diagram-override/user-default/built-in-default fallback pattern

## Status
Decided (2026-08-23)

## Context
Mid-implementation of [epic 0054](../planning/epics/0054-os-conventional-settings-storage.md) (moving `AppSettings` off `localStorage` onto a real per-OS file), the user paused to ask a more fundamental question: this app has at least three different things people were all calling "settings" — a shape's own style, a diagram's highlight catalog, and the app's own global preferences — with no agreed vocabulary distinguishing them, and a handful of existing values (the style palette, gravity presets, max connection points per side) that don't obviously belong to just one of those. Continuing epic 0054's storage migration without settling this risked reshaping `AppSettings` twice in quick succession: once for the storage mechanism, once again shortly after for whichever of these three turned out to need a different shape.

## Decision

**1. Three ownership tiers, plus a non-tier for pure views.** See [the glossary](../architecture/glossary.md) for the full definitions:
- **Properties** — per-element (a shape's style, an element's metadata/tags). Already this codebase's own term (`PropertyPanel.tsx`).
- **Configuration** — per-diagram, stored in `DiagramFile` outside `nodes`/`edges` (`requiredTags`, `highlights`, `legend`, `gravityPresets`, `metadata`, `viewport`).
- **Settings** — per-installation, across every diagram (`AppSettings`). Kept as the name already in use (`SettingsPanel`, the View → Settings menu item) rather than switching to "Preferences" — no functional reason to churn every reference.
- **Views** (Diagnostics, Layers) — not a tier at all; read-only/derived inspection tools with no owned state, called out so they aren't miscategorized.

**2. A three-step fallback pattern — Diagram override → User default → Built-in default — for the specific values where personal-preference-most-of-the-time collides with collaboration-needs-consistency-sometimes.** Applied to:
- **Max connection points per side**: becomes a genuine constraint on what a diagram *can* contain (how many connection points an element may have), not just a display preference. Two collaborators with different personal limits could produce a diagram one of them can't fully edit — a real correctness problem, not a convenience one. Moves to a Diagram override (new `DiagramFile` field) falling back to the existing Settings value as the User default. Tracked as [epic 0073](../planning/epics/0073-max-connection-points-diagram-override.md).
- **Gravity presets**: already has a Diagram override (`DiagramFile.gravityPresets`) and a Built-in default (`DEFAULT_GRAVITY_PRESETS`, epic 0064/ADR 0050) — but no User default in between, so there's currently no way to set your own default preset list across diagrams that don't override it. Tracked as [epic 0072](../planning/epics/0072-gravity-presets-user-default.md).

**3. The style palette gets no Diagram override tier at all — Settings only.** Rejected specifically because it would be redundant: a shape's actual fill/font is already a concrete stored value at the Properties level (same reasoning [ADR 0050](0050-freeform-line-as-node-type.md) already established for gravity values — the catalog only affects what's *offered* while authoring, never what's rendered). Someone who just wants to view a diagram or use its highlights/hierarchy features doesn't need palette access at all; someone who wants to edit and match the diagram's existing conventions can already be handed a real palette file directly (`stylePalette:exportToFile`/`importFromFile`, epic 0030/ADR 0048 — this already exists, nothing new needed there). What *is* new: supporting several named palettes at the Settings level with an active-palette selector (e.g. "Company," "GDPR," "Client"), rather than today's one-palette-replaced-on-import. Tracked as [epic 0074](../planning/epics/0074-multiple-named-style-palettes.md).

## Alternatives considered

**Giving the style palette a diagram-local copy of colors/fonts** (an earlier version of this decision, floated before the "it's redundant with Properties" reasoning above was worked through) — rejected once it became clear the color/font information already travels with the diagram via each element's own stored style; a copy would only ever go stale or need active syncing for zero rendering benefit.

**Renaming Settings to "Preferences"** to read more distinctly from "Configuration" — rejected as pure churn (`SettingsPanel`, `AppSettings`, menu labels, IPC channel names all say "settings" already) for a marginal clarity gain the glossary already provides in writing.

## Consequences
- No change to epic 0054 itself — the fallback-pattern additions (epics 0072/0073) and the multi-palette feature (epic 0074) are new, separately-scoped epics, not folded into 0054's own storage-mechanism work. `AppSettings`'s shape stays whatever it is today for the purposes of that migration; these three land as follow-up changes to that same (now-relocated) file afterward.
- [docs/architecture/glossary.md](../architecture/glossary.md) is the new canonical reference for these terms — use it, not ad hoc phrasing, in future epics/ADRs that touch any of these three tiers.
