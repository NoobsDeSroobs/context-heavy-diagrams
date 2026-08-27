# Glossary

Terms this project uses precisely, for the same reason a shared vocabulary matters in any codebase: so "settings" doesn't quietly mean three different things depending on who's talking. See [ADR 0052](../decisions/0052-settings-ownership-tiers.md) for the reasoning behind this split.

## Ownership tiers

Every piece of state in this app belongs to exactly one of these. The test is *scope*: how far does a change to this value reach?

### Properties
**Scope: one element** (a Shape, Container, Text, Line, or Edge). Everything shown in the Property Panel for a single selected element — style (fill, border, font, line style, markers, ...) and the metadata/tags attached to that specific element. Lives in that element's own `data` on `DiagramNode`/`DiagramEdge`. Changing a shape's fill color never affects any other element.

### Configuration
**Scope: one diagram.** State that applies to every element in a diagram, but only that diagram — stored at the top level of `DiagramFile` (everything except `nodes`/`edges` themselves): `requiredTags`, `highlights`, `legend`, `gravityPresets`, `metadata`, `viewport`. Opening the same `.chd` file always shows the same Configuration, regardless of who opens it or what their own app Settings look like.

### Settings
**Scope: this installation, every diagram.** Your own preferences for how the app behaves, independent of which diagram is open — stored in `AppSettings` (a real per-OS file, previously `localStorage` — see [ADR 0053](../decisions/0053-os-conventional-settings-storage.md)). Examples: the selected-edge highlight color, whether startup scans for crash recovery, the style palette. Two people can have completely different Settings and still collaborate on the same diagram file without conflict — *unless* a particular value actually needs to be consistent for the diagram to make sense (see the fallback pattern below).

### Views
Not a tier — called out so it isn't mistaken for one. Diagnostics and Layers are read-only or derived inspection tools: they show you a projection of the diagram's existing Properties/Configuration, but own no state of their own. Nothing to classify.

## The fallback pattern: Diagram override → User default → Built-in default

Some values sit at the boundary between Configuration and Settings — they're *personal preferences* most of the time, but occasionally need to be pinned per-diagram for collaboration to work. Rather than force every such value into one tier or the other, this app uses a three-step resolution order wherever that tension is real:

1. **Diagram override** — a value stored in the diagram's own Configuration. If present, it wins, and everyone who opens the file sees the same thing.
2. **User default** — your own Settings value, used when the diagram doesn't specify an override.
3. **Built-in default** — a hardcoded constant in the app itself, used when neither of the above exists (a fresh install, or a diagram authored with no override and opened by someone who's never touched their own Settings for it).

This is deliberately *not* applied everywhere — see [ADR 0052](../decisions/0052-settings-ownership-tiers.md) for which values get it and why (max connection points per side, gravity presets) versus which stay Settings-only with no diagram tier at all (the style palette — see that ADR for why a diagram-local copy would be redundant with what Properties already stores).

## Shape vs. Container

Easy to conflate since either can be styled identically, but they mean different things regardless of how they look:

- **Shape** represents a standalone entity in whatever the diagram is modeling — a service, a system, a team, a component, anything the diagram's own domain treats as "a thing." The name itself is a historical holdover from its default plain-box rendering; it doesn't mean "a geometric shape," it means "an entity." A Shape styled to look identical to a Container is still a Shape — the meaning lives in the node's *type*, not its appearance.
- **Container** represents grouping/boundary — a scope that holds other elements, never a standalone entity of its own. A Container never means "a thing"; it always means "a collection of things."

"Shape" is under consideration for a rename to something that reads as a semantic category rather than a visual one (e.g. "Concept"). Deliberately not decided yet, including the actual replacement name; this entry documents the *meaning*, independent of whatever the type ends up being called.
