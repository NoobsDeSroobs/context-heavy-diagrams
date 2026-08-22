# 0055: Required tags — a real list editor for allowed values, and a default-value dropdown

## Status
Not Started — not yet scoped. Raised by the user (2026-08-22) while reviewing the Meridian Rail landscape's generated tags, with a second related idea added the same day. Deliberately not designed here, just captured so it isn't lost, same as epics 0024/0026/0030/0037/0038/0048 before their own design passes. **Explicitly told to log this for later, not build it now.**

## Goal
Two coupled improvements to the required-tags panel's per-tag editing:
1. Replace the current allowed-values field — a single comma-separated text input (`RequiredTagsPanel.tsx`, `tag.allowedValues?.join(', ')` in, split-on-comma out) — with a real list editor. The user's own framing: "hard to use... when it is squeezed into the corner like that."
2. Once allowed values are a real list rather than free text, the **default value field should become a dropdown populated from that same list**, instead of today's independent free-text input — raised second, explicitly coupled to #1 ("based on the options in the list"), so #1 is the natural prerequisite.

## Relevant existing behavior
- `RequiredTagsPanel.tsx`'s `allowedField` is one `useFieldDraft`-backed text input per tag, parsed via `parseAllowedValues` (split on `,`, trim, drop empties).
- `defaultField` (same file) is a separate, independent `useFieldDraft` free-text input — entirely unaware of `allowedValues` today; typing an out-of-range default is possible right now with no validation at this field itself (the app resets an out-of-range `lockedEditable` value back to `defaultValue` elsewhere, per `docs/file-format.md`'s Required tags section, but that's a different mechanism, not this field).
- No structure beyond either — adding/removing/reordering an allowed value means editing the whole comma-separated string by hand, and setting a default means retyping it as free text with no relationship to what's actually allowed.

## Real open questions (deliberately not resolved here)
- **Proposed shape**: a collapsed-by-default list view under each tag, showing its allowed values as individual rows rather than one flat string.
- **How new values get added** — two ideas raised, not decided between:
  - An explicit "Add new value" button.
  - Buttonless: typing into the current last (blank) row automatically grows the list by one more blank row, spreadsheet-style. **The user's own stated preference**, but explicitly flagged as something to discuss further before committing, not a final decision.
- Reordering, removing a value, and how this interacts with an in-use value (a highlight or an existing element's metadata already referencing it) — not discussed at all yet.
- **Default-value dropdown specifics**: what happens if `allowedValues` is empty/unset (no constraint at all) — free text still, or does the field just stay disabled until at least one allowed value exists? What happens to an *existing* default value that's no longer in the list after an edit — reset it, or leave it stored but now technically out-of-range?

## Notes
Not scheduled into any current batch — flagged here so it isn't lost, not because it's next up. Raised alongside a separate, unrelated observation: the Meridian Rail landscape's generated edges all show default tag values because the generator script never gave them real per-edge metadata (a content gap in that file, not an app bug) — see [epic 0022](0022-example-diagram-gallery.md)'s own Notes.

**Second round, 2026-08-22**: default-value-as-dropdown idea added, explicitly coupled to the allowed-values list editor above rather than logged as its own separate epic — a dropdown only really makes sense once allowed values are a real list, not a string to parse.
