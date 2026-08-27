# 0010: Named, searchable style presets for shapes and edges

## Status
Accepted

## Context
Discussing the not-yet-started styling panel and connection points, two related points came up:

1. **Interaction pattern**: styling controls (fill/border for shapes; line style and start/end markers for edges) will need a right-click context menu, the same way icons, details, and links already do — not just the properties-panel-on-selection the project brief originally specified. The two aren't in conflict; they serve different granularities (see Decision).
2. **A bigger, more novel idea**: per ADR 0008, this tool is meant to take an architect most of the way toward proper practice without enforcing a rigid notation. One concrete, low-cost way to do that: when picking an edge's line style or arrow ends, show the choice by **plain-English, industry-recognized name** — "Dependency (UML)", "One-to-many (ERD)", "Composition (UML)" — not just a raw visual preview of dashes and arrowheads. A novice building an ER diagram often knows they want "one-to-many," but may not know that's conventionally drawn as a crow's-foot at one end and a bar at the other. Naming the convention and making it *searchable* by domain keyword ("database", "orm", "uml", "bpmn") turns the picker into a lightweight teaching tool, without stopping anyone from ignoring the name and picking whatever visual style they actually want — nothing enforces that a "Dependency"-labeled arrow is used correctly, same as nothing enforces correct usage of any shape today.

This searchability is explicitly the same shape as the **standard** side of the metadata split established in [ADR 0009](0009-custom-metadata-bucket.md) (tool-curated, structured, not user-editable) — but it's a distinct application of that idea, not the same feature. ADR 0009's `metadata` field is arbitrary data a *user* attaches to *their own* diagram elements. This decision is about the *tool's own built-in catalog* of style presets carrying searchable tags — closer in spirit to `src/renderer/src/icons/builtinIcons.ts`'s existing `searchBuiltinIconIds(query)` than to ADR 0009's user-facing bucket. Worth being precise about which is which so the two don't get conflated later.

## Decision
**Presets are a picker mechanism, not stored state.** A named preset (e.g. "Dependency (UML)") is never saved on the edge/node itself — only the raw visual properties it applies (line style, stroke color, start/end marker) are. Picking a preset just pre-fills those raw fields; nothing "remembers" that an edge was created via the "Dependency" preset, and nothing breaks or goes stale if someone later hand-tweaks the color. This keeps the file schema exactly as simple as the project brief's original draft `style` object already envisioned (`stroke`, `strokeWidth`, `fill`, plus new marker fields for edges) — no new schema concept, just a picker UI on top of it.

**Built-in preset catalog**: a new module alongside `builtinIcons.ts` (e.g. `src/renderer/src/styles/builtinLineStyles.ts`), each entry roughly:
```ts
interface LineStylePreset {
  id: string
  label: string      // "Dependency (UML)"
  keywords: string[] // ["uml", "dependency", "uses"]
  style: { lineStyle: 'dashed', startMarker: 'none', endMarker: 'arrowOpen' }
}
```
with a `searchLineStylePresets(query)` mirroring `searchBuiltinIconIds(query)` exactly — same flat, filter-by-substring UX as the existing icon picker, not a new interaction pattern to learn. Covers, at minimum: generic (plain arrow, plain line, no markers), UML (association, dependency, generalization/inheritance, aggregation, composition, realization), ERD/crow's-foot (one-and-only-one, zero-or-one, one-or-many, zero-or-many, on both ends independently), and process/flow-style (BPMN-ish sequence flow, generic data-flow arrow). Expect this list to grow the same way the diagram-type gallery does — every EA/technical diagram type attempted there that needs a notation this catalog doesn't have yet is a concrete, evidence-driven reason to add one, not speculative upfront completeness.

**Interaction pattern: hybrid, not a replacement.** The project brief's "properties panel when an element is selected" (item 8) remains the source of truth for exact manual control (a specific hex color, an exact stroke width) — that requirement isn't being dropped. But the *searchable preset picker* is reached via right-click, reusing the exact popup pattern `IconPicker` already established (fixed-positioned near the click point, not inheriting canvas zoom/pan — see `DiagramContext`'s existing reasoning for why). Concretely: right-click a shape gets new "Fill…" / "Border…" items; right-click an edge gets "Line style…" (opens the searchable named-preset picker, pre-filtered/organized the same way icons are). The panel and the context-menu picker edit the *same* underlying raw style fields — there's no separate "preset identity" to keep in sync, per the point above.

## Alternatives considered
- **Visual-only picker, no names** (what most diagramming tools actually do — draw.io's arrow style picker is a grid of visual swatches): simpler to build, no content-curation burden. Rejected as the sole approach because it does nothing for the stated goal of helping a novice discover the *conventional* choice for what they're trying to represent — you already have to know what you're looking for to recognize it visually.
- **Enforce/validate notation** (e.g. block picking an ERD-style marker on an edge between two "Person" shapes that aren't tagged as ERD entities): would make diagrams more likely to be notationally correct, but reintroduces exactly the rigid, restrictive metamodel [ADR 0008](0008-tool-scope-includes-ea-adjacent-diagrams.md) already rejected for the tool as a whole. Naming and search are guidance; they inform a choice without constraining it — consistent with every other decision made about this tool's flexibility.
- **Store the preset name/id on the edge** instead of just the raw style it applies: would let the UI show "this edge is currently styled as a Dependency," which has some value, but goes stale the instant someone hand-edits the color, creating a misleading label. Rejected — raw properties are the only truth; naming is purely a picking-time aid.

## Consequences
- No schema surprises: this rides on the `style` object the styling work already needs to add (per the brief's own draft), plus new marker fields for edges (`startMarker`/`endMarker`) that don't exist as a concept anywhere yet and need defining alongside it.
- Building and maintaining a useful preset catalog is real, ongoing content work (correctly representing UML/ERD/BPMN conventions), not just a UI feature — treat it with the same "grows as evidence demands" posture as the diagram gallery, not a one-time deliverable to finish and forget.
- The context-menu-vs-panel split needs to actually feel complementary once built, not confusing (two different places that both "do styling"). Worth a deliberate UX pass when the styling panel is implemented, not just an assumption it'll be fine.
- `docs/file-format.md` will need the new `style`/marker fields documented once they exist, same as every other schema change.
