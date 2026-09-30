# Glossary

Terms this project uses precisely, for the same reason a shared vocabulary matters in any codebase: so "settings" doesn't quietly mean three different things depending on who's talking. See [ADR 0052](../decisions/0052-settings-ownership-tiers.md) for the reasoning behind this split, and its 2026-08-27 addendum for the "Configuration → Diagram settings" / "Settings → Preferences" rename that gave the two middle tiers their current names.

## Ownership tiers

Every piece of state in this app belongs to exactly one of these. The test is *scope*: how far does a change to this value reach?

### Properties
**Scope: one element** (an Entity, Container, Text, Line, or Edge). Everything shown in the Property Panel for a single selected element — style (fill, border, font, line style, markers, ...) and the metadata/tags attached to that specific element. Lives in that element's own `data` on `DiagramNode`/`DiagramEdge`. Changing an entity's fill color never affects any other element.

### Diagram settings
**Scope: one diagram.** State that applies to every element in a diagram, but only that diagram — stored at the top level of `DiagramFile` (everything except `nodes`/`edges` themselves): `requiredTags`, `highlights`, `legend`, `gravityPresets`, `maxConnectionPointsPerSide`, `metadata`. Opening the same `.chd` file always shows the same Diagram settings, regardless of who opens it or what their own Preferences look like. Camera position (pan/zoom) is deliberately *not* part of this tier — it isn't persisted at all (see [ADR 0090](../decisions/0090-drop-viewport-persistence.md)). The View → **Diagram settings** panel (`DiagramSettingsPanel`) edits the subset a human authors directly. (Older docs/comments call this tier "Configuration".)

### Preferences
**Scope: this installation, every diagram.** Your own choices for how the app behaves, independent of which diagram is open — stored in `AppPreferences` (a real per-OS file, previously `localStorage` — see [ADR 0053](../decisions/0053-os-conventional-settings-storage.md)). Examples: the selected-edge highlight color, whether startup scans for crash recovery, the style palette. Two people can have completely different Preferences and still collaborate on the same diagram file without conflict — *unless* a particular value actually needs to be consistent for the diagram to make sense (see the fallback pattern below). The View → **Preferences** panel is `PreferencesPanel`. (Older docs/comments call this tier "Settings"; the on-disk file is still `settings.json`.)

### Views
Not a tier — called out so it isn't mistaken for one. Diagnostics and Layers are read-only or derived inspection tools: they show you a projection of the diagram's existing Properties/Diagram settings, but own no state of their own. Nothing to classify.

## The fallback pattern: Diagram override → User default → Built-in default

Some values sit at the boundary between Diagram settings and Preferences — they're *personal preferences* most of the time, but occasionally need to be pinned per-diagram for collaboration to work. Rather than force every such value into one tier or the other, this app uses a three-step resolution order wherever that tension is real:

1. **Diagram override** — a value stored in the diagram's own Diagram settings. If present, it wins, and everyone who opens the file sees the same thing.
2. **User default** — your own Preferences value, used when the diagram doesn't specify an override.
3. **Built-in default** — a hardcoded constant in the app itself, used when neither of the above exists (a fresh install, or a diagram authored with no override and opened by someone who's never touched their own Preferences for it).

This is deliberately *not* applied everywhere — see [ADR 0052](../decisions/0052-settings-ownership-tiers.md) for which values get it and why (max connection points per side, gravity presets) versus which stay Preferences-only with no diagram tier at all (the style palette — see that ADR for why a diagram-local copy would be redundant with what Properties already stores).

## Entity vs. Container

Easy to conflate since either can be styled identically, but they mean different things regardless of how they look. (Renamed from Shape/Container 2026-09-30 — see [ADR 0101](../decisions/0101-shape-to-entity-rename.md) — including the on-disk `.chd` type value and the code's own node type/component/CSS naming; a pre-rename file's `"shape"` type is accepted as a synonym for `"entity"` on load, per [docs/file-format.md](../file-format.md).)

- **Entity** represents a standalone thing in whatever the diagram is modeling — a service, a system, a team, a queue, anything the diagram's own domain treats as "a thing." An Entity styled to look identical to a Container is still an Entity — the meaning lives in the node's *type*, not its appearance.
- **Container** represents grouping/boundary — a scope that holds other elements, never a standalone thing of its own. A Container never means "a thing"; it always means "a collection of things."

**Both are scoped to the diagram they're drawn in, not absolute.** What's a Container in one diagram — a logical grouping of several related Entities — can itself be drawn as a single Entity in a different, higher-level diagram. For example: a diagram scoped to a cross-functional team might show each of that team's services as a Container, with the compute, queues and storage that make it up as the Entities inside it; a diagram one level up, scoped to the whole organization, might then draw that entire service as one Entity, linked (via an Entity's `linkedDiagram`) down to the more detailed diagram it's a Container in. Nothing new needs building for this — it's exactly what linked-diagram drill-down already does; naming Entity/Container this way just makes the existing mechanic legible.

One consequence worth being explicit about: an Entity is not necessarily atomic. It means "this diagram treats it as one thing and isn't modeling its internals here" — not "this thing has no internal structure." An Entity can be arbitrarily complex underneath, visible by following its linked diagram.
