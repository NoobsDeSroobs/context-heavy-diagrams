# 0058: An implicit "None" value for required tags

## Status
Not Started — not yet scoped. Raised by the user (2026-08-22) after manually adding a literal `"None"` string to several tags' allowed values on the Meridian Rail landscape, to represent edges with no owning team/domain. Deliberately not designed here, just captured so it isn't lost, same as epics 0024/0026/0030/0037/0038/0048/0055/0056/0057 before their own design passes. **Explicitly told to log this for later, not build it now.**

## Goal
Every required tag should have an implicit "not applicable" value available — the user's own framing: "None should not have to be added to the list of options for it to be there, but it should be there such that the highlights and dropdowns can select and target those entities." Two parts:
1. Always-available, without needing to be added to `allowedValues` explicitly.
2. The default value for a freshly-created tag, unless the user deliberately sets something else.

## Relevant existing behavior
- This app already has exactly this kind of "implicit member of a set, real once touched" pattern elsewhere — epic 0039's connection points (`effectivePointsForSide` in `connectionPoints.ts`): a side with no explicit points has one implicit, centered point (`{id: side, side, offset: 0.5}`), synthesized on demand, that becomes a normal stored point the moment the side is actually edited. Precedent worth reusing the shape of, not necessarily the mechanism.
- Per `docs/file-format.md`'s Required tags section: `allowedValues`, when set, constrains what a `lockedEditable` entry's value is allowed to be — **this app resets an out-of-range value back to `defaultValue` whenever the diagram is opened or the template is edited.** This is the sharp edge for whoever builds this: an implicit "None" must be treated as always-in-range by that same reconciliation logic (`syncElementMetadata`/`runSync`), or every "None"-valued element would get silently reset back to the tag's real default on next load — exactly backwards from the intent.
- `HighlightsPanel.tsx`'s "add highlight" picker only offers `key`/`value` pairs currently in use somewhere (`usedTags`, scanned from live metadata) — an implicit "None" that's never actually *stored* as a real value on any element wouldn't show up there. Whatever "None" resolves to on disk needs to be a real, matchable value, not just a UI-layer default-when-blank convention, or highlighting/targeting "None" specifically (the user's explicit ask) won't work.

## Real open questions (deliberately not resolved here)
- **Canonical representation** — JSON `null`, or the literal string `"None"`? `null` is more semantically distinct (can't collide with a real tag value someone happens to type as "none"), but interacts with `parseDefaultValue`'s existing JSON-first-then-string-fallback parsing (typing `null` in today's free-text default field already produces JSON `null`). The literal string is simpler to read in a raw `.chd` file and matches what the user's already been typing by hand, but risks exactly the collision `null` avoids.
- **Always-on for every tag, or opt-out per tag?** The user's framing ("many tags... not applicable to all entities no matter what") suggests universal, but doesn't explicitly rule out a tag where forcing a real value makes more sense.
- **Interaction with `lockedStatic`** — a `lockedStatic` entry always holds the template's own `defaultValue` with no per-element override at all. Does "None" as a *default* even make sense there, or is this feature really only meaningful for `lockedEditable`?
- **Rendering/display** — does "None" show as literally the word "None" in the property panel/metadata section, or blank/em-dash/something else?
- Directly related to [epic 0055](0055-required-tags-allowed-values-list-editor.md)'s default-value dropdown — once that exists, "None" would need to appear there as a selectable option without being a real row in the allowed-values list underneath it.

## Notes
Not scheduled into any current batch — flagged here so it isn't lost, not because it's next up. The user's own immediate workaround (manually adding the literal string `"None"` to affected tags' allowed values, and asking to set it explicitly on the landscape's edges) stays in place as real content until this gets designed and built properly — see [epic 0022](0022-example-diagram-gallery.md)'s own Notes for that specific edit.
