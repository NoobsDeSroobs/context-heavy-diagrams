# 0054: Progressive disclosure is a standing rule for every advanced feature

## Status
Accepted (2026-08-24)

## Context
This app started as a plain diagramming tool (shapes, containers, edges) and has since accumulated a growing set of optional, deeper-context features on top of that base: free-form Details notes, linked child diagrams, the tag/metadata system, highlights, the legend — and now a threat/risk security matrix, the most substantial addition yet. Each of these was added additively to the `.chd` format and, individually, was designed not to impose itself on a diagram that doesn't use it. But that restraint had never been written down as a rule binding on *future* features — it was an emergent pattern, not a stated constraint.

The security matrix forced the question explicitly: it is a meaningfully bigger, more visually and conceptually distinct addition than a Details panel or a highlight. Raised directly by the user alongside that feature's "does this belong here at all" resolution: this app "should not force you to use its advanced options" — someone who only ever draws shapes, containers, and edges should see an experience indistinguishable from the one this app had before any of these features existed.

## Decision
**Every advanced feature — existing and future — must be opt-in and functionally invisible to a diagram that doesn't use it.** Concretely:
- **File format**: an unused feature adds nothing to a saved `.chd` file. This is already the established convention for every optional top-level/per-element field (`requiredTags`, `highlights`, `legend`, `gravityPresets`, `metadata`, `data.details`, `data.linkedDiagram` — see [docs/file-format.md](../file-format.md)'s "absent means none" rule repeated across every one of them) — this ADR formalizes it as a requirement for new fields going forward, not just an incidental pattern so far.
- **UI**: no panel, menu item, or mode toggle for an unused feature appears uninvited. A feature earns its presence in the UI only once the user has actually engaged with it (created a Detail, added a highlight, opened the security matrix at least once), or via an explicit, discoverable but unobtrusive entry point (a toolbar button, a menu item) — never a default-visible panel competing for space with the base diagramming experience.
- **Performance**: an unused feature must not cost anything at runtime for a diagram that doesn't use it — no background computation, no re-render cost, no load-time work scaling with a feature nobody touched.

## Alternatives considered
**Leaving this as an unwritten, case-by-case judgment call**, the way it had been handled up through the legend feature — rejected once the security matrix raised a feature big enough (a full alternate view mode, not just a panel) that getting this wrong would be a real regression to the base experience, not a minor UI inconsistency.

## Consequences
- Binds the security-matrix implementation regardless of which mechanism it lands on (mode-switch view, per-shape data, or both — see [ADR 0055](0055-security-data-lives-on-diagram-elements.md)).
- Any future work adding a new advanced feature should check itself against this ADR before design, not after.
- No code changes of its own — this codifies an existing pattern and constrains future work, it doesn't retrofit anything.
