# 0026: Grouped highlights instead of a key-level highlight scale

## Status
Accepted

## Context
Grouped highlights were logged during the tag-highlight design as a deferred idea: a "macro" highlight keyed on a tag's key alone (`GDPR`), with a whole value→color mapping, instead of one highlight per exact key=value pair — deliberately left undesigned since the user wasn't happy with any design yet and wanted to think it through themselves.

The user came back with a simpler proposal: an "Add group" action that auto-generates one ordinary highlight per distinct value already used for a chosen key (e.g. every value ever seen under `GDPR`), displayed together under a collapsible group header with its own bulk on/off checkbox — while each value keeps its own individual checkbox and color underneath. This turns out to need no new matching mechanism at all: a "group" is just several of the existing `{key, value, color}` highlights that happen to share a key, organized for display.

## Decision
- **Grouping is a pure display-time concept, not a schema change.** The Highlights panel groups the existing `highlights` array by `.key`. Any key with 2+ entries renders as a collapsible section with a header and a tri-state bulk checkbox; a key with exactly one entry renders as today's plain row, unchanged. `DiagramFile.highlights`/`HighlightDefinition` are untouched — a group is discovered from data that already exists, not a new persisted concept.
- **"Add group" reconciles, it doesn't just append.** Picking a key scans every node/edge's metadata for that key's distinct current values and reconciles the catalog: adds a new entry (white, disabled) for any value not yet covered, and *removes* any existing entry for that key whose value nothing in the diagram carries anymore. Confirmed directly with the user against a concrete scenario (a business retiring a "Sensitive PII" distinction in favor of always treating PII at the highest standard) — a leftover row for a retired value doesn't just sit there unused, it's actively misleading, so it's removed rather than kept. Existing entries for values still in use are untouched — their color and enabled state survive a reconcile.
- **New highlights default to white, not a rotating color palette** — specifically to guarantee no accidental collision with whatever colors are already in use elsewhere, at the cost of every fresh entry looking the same until deliberately recolored. Applied uniformly to both creation paths (the existing single "Add highlight" flow and the new "Add group" bulk-create) for one consistent rule rather than two different defaults depending on how an entry was created.
- **Reconcile is an explicit, user-triggered action, not a live background sync.** Re-running "Add group" for an already-grouped key (or a small per-group resync control) is what triggers the add-missing/remove-stale pass — nothing reconciles automatically just because metadata changed elsewhere, consistent with this app's existing "Recheck" pattern (`DiagnosticsPanel`) rather than a surprising silent deletion the moment a value stops being used.
- **The group checkbox is a standard tri-state "select all"**: checked when every member highlight is enabled, unchecked when none are, indeterminate when mixed. Clicking it enables all members if not already fully enabled, otherwise disables all of them.

## Alternatives considered
- **A genuine key-level highlight type** (one `{key, valueColorMap, enabled}` entity with its own matching logic), the original framing of the deferred idea. Rejected once the simpler grouping idea surfaced: it would have needed a schema change, a new rendering path, and its own answer to "what happens when this overlaps with an ordinary key=value highlight" — all real complexity the grouping approach doesn't need, since a group is just existing highlights.
- **Inferring color from value order** (e.g. a severity gradient from the "Not relevant → Sensitive PII" example). Rejected — metadata values are plain strings with no inherent ranking the app can see; guessing at an order that isn't actually in the data would be worse than a neutral default the user recolors deliberately.
- **Additive-only reconcile** (never remove a stale row, only ever add new ones) — the author's own first instinct. Rejected directly by the user with a concrete business scenario: a row for a retired value isn't harmless leftover state, it's actively confusing, so removal on reconcile is correct.

## Consequences
- No changes needed to `src/shared/diagram.ts`, `serializeDiagram`/`parseDiagram`, or the file format — grouping is entirely a renderer/panel-side feature on top of the already-shipped highlight persistence.
- The Highlights panel needs a second add flow (a key-only picker, distinct from "Add highlight"'s key+value picker) and a grouped-vs-flat rendering split, but the underlying add/remove/toggle/recolor operations are the exact same ones already built (`addHighlight`/`removeHighlight`/`updateHighlightColor`/`toggleHighlightEnabled`) — the reconcile pass is just multiple calls to those, not new state-mutation logic.
- A group's membership can silently shrink between one open and the next if values genuinely stop being used and someone reconciles it — acceptable since reconciling is always an explicit click, never automatic, and the original "key-level scale" idea is fully superseded by this, not layered alongside it.

## Addendum (2026-09-23): required-tag groups seed from allowedValues, and resync is automatic

Real use surfaced two gaps in the original decision:

- **A required tag's group only ever showed values already in use**, same as a free tag's. For a compliance-style rollup ("does any domain hold GDPR data?") the useful view is the whole legend of *possible* values up front — including one nothing currently carries — not a group that only grows as elements happen to get tagged.
- **"Reconcile is explicit, never automatic" (this ADR's original decision) turned out to be the wrong default in practice.** Adding a new allowed value to a required tag, or a new value to a free tag, left every already-added group stale until someone remembered to click its ↻ button.

**New rules:**
- A group whose key is a required tag with a real `allowedValues` list seeds and resyncs from that **full list**, plus that tag's own implicit "None" (ADR 0046) — every legal value gets a slot, used or not. A free tag (or a required tag with no `allowedValues`, i.e. free text) keeps the original "whatever's actually in use" behavior, since there's no fixed universe to enumerate instead.
- **Resync is now automatic** for any key that already has a group — adding an allowed value, or a new value for a free tag actually appearing somewhere in the diagram, updates that group's rows without a manual click. A key with no group yet is still never auto-created ("Add group" stays deliberate).

`highlightGroupSourceValues` (`highlights.ts`) is the one place that decides a group's source (allowedValues vs. usedTags), shared by "Add group," the (now largely redundant but harmless) manual per-group resync button, and the automatic resync. The automatic resync itself is computed directly in `Canvas.tsx`'s render body, conditionally calling `setHighlights` when the reconciled result actually differs — not a `useEffect`, since deriving one piece of state from another synchronously inside an effect is exactly the anti-pattern this project's lint setup (and react.dev's own guidance) flags; the render-time version is idempotent by construction (an unchanged source reconciles to a referentially-unchanged result) so it settles in at most one extra render, never loops.
