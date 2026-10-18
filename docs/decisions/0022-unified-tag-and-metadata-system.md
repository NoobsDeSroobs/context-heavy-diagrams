# 0022: Unified tag and metadata system

## Status
Accepted — supersedes [ADR 0009](0009-custom-metadata-bucket.md)

## Context
Adding YAML frontmatter to detail `.md` files was next up. Before implementing it, a direct design discussion with the user surfaced that two *other* already-designed pieces — [ADR 0009](0009-custom-metadata-bucket.md)'s opaque metadata bucket, and the tags-for-highlighting design — covered frontmatter's actual motivations (semi-structured fields, a richer tooltip) more directly than frontmatter itself would. Working through *why* those two should or shouldn't be separate mechanisms is what this ADR actually records.

The discussion resolved several real forks in sequence:
- Whether app-hardcoded "standard" fields (GDPR, Risk, etc.) made sense at all, versus a diagram-defined required-field template.
- Whether tags needed to be key-value pairs (to express degrees — "Risk: High" — not just flat presence/absence strings).
- Whether "required" (diagram-enforced) and "free" (elective) fields needed separate storage, or could share one mechanism distinguished by a lock property.
- Whether locking should be human-controllable from the GUI.
- What "opaque" in ADR 0009 actually meant, and whether it still applies.

## Decision

**One per-element field, not two.** `data.metadata?: Record<string, MetadataEntry>` on `ShapeNode`, `ContainerNode`, and edges — not `TextNode` (never connectable, never really "a thing" the metadata would describe) or the since-removed `AnchorNode` (a transient placeholder per ADR 0015).

```ts
export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue }
export type MetadataLock = 'lockedEditable' | 'lockedStatic'
// absent = unlocked: key removable, value freely editable (an ordinary free/human-added entry)
// lockedEditable: key NOT removable, value IS editable (a required field still needing a human to fill in)
// lockedStatic: key NOT removable, value NOT editable (fixed diagram-wide, or protected external-tool data)

export interface MetadataEntry {
  value: JsonValue
  lock?: MetadataLock
}
```

**A diagram-level template drives what's required**, not app-hardcoded field names:

```ts
export interface RequiredTagDefinition {
  key: string
  allowedValues?: string[]   // optional enum constraint
  defaultValue?: JsonValue
  lock: 'lockedEditable' | 'lockedStatic'   // never unlocked — that wouldn't be "required"
}
// DiagramFile.requiredTags?: RequiredTagDefinition[]
```

On creating a new Shape/Container/Edge (or resolving an `AnchorNode` into one), the app seeds `data.metadata` with one entry per `requiredTags` definition, using its `defaultValue` and `lock`. After that, it's an ordinary `MetadataEntry` like any other — no separate storage, no special-casing elsewhere in the code.

**Retroactive backfill when the template changes**, not just going forward:
- `lockedEditable` entries: keep the existing value if still valid; reset to `defaultValue` if invalid (only meaningful when `allowedValues` is set and the old value fell out of the new list — a field with no `allowedValues` has nothing to be invalid against).
- `lockedStatic` entries: always take the template's current value — there's no distinct per-element value to preserve for a field that was never editable in the first place.
- A key **removed** from `requiredTags` is not deleted from elements that had it — it's demoted to unlocked (`lock` cleared), preserving the data while no longer enforcing it. Consistent with this project's existing precedent of not silently destroying data as a side effect of a policy change (container deletion promotes children rather than deleting them, [ADR 0012](0012-container-node-design.md)).
- If demoting a key would collide with an already-existing distinct entry under that same key (e.g. from an earlier demote-then-reinstate cycle on the same element), the *demoted* entry gets a disambiguating affix (`"<key> (demoted)"`) rather than clobbering the other entry. The colliding entry keeps its clean key name; the historical one carries the marker.
- Every reset or demotion is surfaced as one entry in a new diagnostics/notifications panel (non-blocking, visible — see Consequences), in the form "Invalid value in `<element label>.<field key>` found, reset to default value," one per instance.

**No human-facing lock/unlock control in the GUI.** `lock` is purely a provenance signal set by the diagram's `requiredTags` template or by an external tool writing the file directly — never something a human toggles through the app. Two reasons, both concrete: allowing GUI unlock would need a third lock-adjacent state to distinguish "locked by policy" from "manually overridden," for a feature that's trivially circumventable anyway (a human motivated enough to hand-edit the raw `.chd` JSON can already change any lock value directly — this system is a guardrail against GUI mistakes, not a security boundary, and someone going that far is assumed to know what they're doing). The actual underlying need — protect against accidental edits/deletes — is served differently: every metadata value (locked or not) requires a deliberate action to edit, reusing the same static-display → click-to-edit → commit/cancel pattern `EditableLabel` already established for node/edge labels, and deletion requires an explicit small delete action per row, same pattern already used for removing a connection point ([ADR 0021](0021-connection-point-removal-blocked.md)). This is a UI-layer safeguard applied uniformly to every entry, entirely decoupled from `lock` — `lock` is about who's allowed to remove/edit at all; the click-to-edit pattern is about preventing fumble-fingering regardless of that answer.

**Metadata is not opaque to interpretation — this reverses ADR 0009's core premise.** ADR 0009 was built around "the app promises never to interpret what's inside the bucket," for scripts/AI-generation bookkeeping. The actual intent, confirmed directly by the user, is the opposite: this data is meant to be read and acted on, by the app's own highlight/overlay feature ("highlight all GDPR-sensitive services" keys off a specific `key`+`value` match, not mere tag presence) *and* by external tooling. `lock` only ever restricts who can *edit* a value through the GUI — it says nothing about who can *read or act on* it. Visibility was never in question either way; every entry is always shown in the GUI (a raw-JSON-textarea's original purpose was exactly this), including nested values, which render/edit as their stringified JSON form in that one row rather than requiring a whole-document structured editor — preserving the "nothing invisible to a human auditor" principle without needing a recursive editor.

## Alternatives considered
- **Separate `data.tags: string[]` (flat) + `data.metadata` (opaque dict) as two fields**, per the frontmatter, metadata-bucket, and tagging designs as originally written: rejected. A flat string list can't express degrees ("Risk: High") without combinatorial strings and no structural guarantee against contradictory values (`risk-low` and `risk-high` both present). Once locking makes required-vs-free entries behaviorally distinguishable within one dict, keeping two separate storage mechanisms with identical underlying capability (view/add/remove key-value pairs) stopped being justified.
- **App-hardcoded standard field vocabulary** (the tool ships with fixed concepts like GDPR/Risk): rejected — directly conflicts with [ADR 0008](0008-tool-scope-includes-ea-adjacent-diagrams.md)'s "flexibility, not formal notation" stance. The diagram-level `requiredTags` template gets the same "always there, curated, validated" benefit without the tool imposing a specific domain vocabulary on every diagram.
- **Raw JSON textarea as the bucket's only GUI** (ADR 0009's original choice): rejected in favor of a list-view in the Properties Panel, one row per entry — nested values shown/edited via their stringified JSON form per-cell, not a whole-document blob. Keeps arbitrary structure fully representable (the reason a table editor was rejected the first time) while making individual entries scannable and independently editable.
- **Human-settable lock/unlock**: rejected — see Decision above for the full reasoning (extra state to track, trivially bypassable via direct file editing anyway, and the real need is already met by reusing the click-to-edit pattern).
- **Deleting demoted-required entries outright**: rejected, same "don't destroy data as a side effect of policy" precedent cited above.

## Consequences
- Supersedes ADR 0009 in full — its "never the app's business" framing no longer holds; this ADR is the current source of truth for this field.
- The planned YAML frontmatter feature is retired — its two motivations (semi-structured fields, richer tooltip) are both covered here instead.
- The originally-planned standalone custom metadata bucket is superseded by this design.
- The tag-based highlight/overlay work's design (originally `data.tags: string[]`) is revised to reference this unified `data.metadata` model; its own remaining scope narrows to just the highlight/overlay visualization layer built on top of it. Its previously-open question of "does a highlight key off tag presence or a specific value" is resolved here: key+value.
- New UI surface needed: a diagnostics/notifications panel (it became a dock panel, the Diagnostics panel). First concrete use is surfacing backfill/reset events, but it's meant to generalize to other future diagram-health checks (e.g. invalid metadata JSON already had a similar non-blocking-but-flaggable need).
- `docs/file-format.md` needs `data.metadata` and `DiagramFile.requiredTags` documented once implemented, matching the existing per-field table format.
- Diagram-level metadata (a free-form dict on `DiagramFile` itself, from ADR 0009's original scope) is retained as a simple unlocked dict — "required tags" is a concept about what elements must carry, not something meaningfully self-referential at the diagram level.
