# 0055: Required tags — a real list editor for allowed values, and a default-value dropdown

## Status
Done (2026-08-22)

## Goal
Two coupled improvements to the required-tags panel's per-tag editing:
1. Replace the current allowed-values field — a single comma-separated text input (`RequiredTagsPanel.tsx`, `tag.allowedValues?.join(', ')` in, split-on-comma out) — with a real list editor. The user's own framing: "hard to use... when it is squeezed into the corner like that."
2. Once allowed values are a real list rather than free text, the **default value field should become a dropdown populated from that same list**, instead of today's independent free-text input — raised second, explicitly coupled to #1 ("based on the options in the list"), so #1 is the natural prerequisite.

## Decisions made
Full reasoning in [ADR 0047](../../../decisions/0047-allowed-values-list-editor.md). Short version, resolving the epic's own open questions:
- **No `.chd` schema change** — `allowedValues` was already a plain `string[]` on disk; only the editing UI changes. The user flagged this as the first epic needing real backward-compat thought; traced through and confirmed the actual risk was narrower than it first looked (below).
- **Add**: buttonless via a trailing always-blank row, per the user's stated preference — commits on blur/Enter (not per-keystroke, matching every other field in this panel).
- **Reorder**: up/down buttons, not drag-and-drop — simpler for a typically-short list.
- **Remove/rename of an in-use value**: confirmation prompt (reusing the existing `confirm()` pattern from Close/Reload/copy-to-children), since a one-click row action is easier to trigger by accident than the old blur-a-whole-string field. No cascading rename to existing element metadata/highlights — treated as remove-old-add-new, same as an outright removal; the existing highlight "resync group" control already handles cleaning up an orphaned highlight afterward.
- **Default-value dropdown**: free text still when `allowedValues` is empty (unchanged from today). When non-empty, a dropdown with an implicit "None" option (epic 0058) plus every allowed value. **The real backward-compat question**: `defaultValue` was never validated against `allowedValues`, so an existing file can already have a mismatched default — confirmed with the user before building that the dropdown should show and preserve that value (labeled "not in list") rather than silently resetting or dropping it.

## Tasks
- [x] `RequiredTagsPanel.tsx` rebuilt: `AllowedValuesEditor`/`ValueRow` components, `usedTags` threaded in as a new prop (reusing Canvas.tsx's existing scan, same one `HighlightsPanel` uses).
- [x] `panels/fields.tsx`'s `CollapsibleSection` gains an optional `defaultOpen` prop (default `true`, every other caller unaffected); allowed-values list uses `defaultOpen={false}`.
- [x] Default-value field: dropdown when `allowedValues` is non-empty (with the orphan-value fallback option), free text otherwise.
- [x] `docs/file-format.md`'s `defaultValue` row documents the no-validation-against-`allowedValues` rule explicitly.
- [x] `npm run typecheck` clean; `npm run lint` shows the same 4 pre-existing errors (epic 0028), zero new ones.

## Notes
**Live-testing bug found and fixed the same day**: removing the Meridian Rail landscape's `owningTeam` tag's `"None"` allowed value (a real value from epic 0022's 13th round) while it was also that tag's current default triggered the in-use confirmation — and dismissing it, confirmed or cancelled, left every `<select>` in the panel unresponsive to clicks, no console error. Root cause not fully understood at the Electron/Chromium level, but the native `window.confirm()` dialog itself was the trigger — replaced with an in-panel confirmation (row swapped for an inline Confirm/Cancel), avoiding the native dialog entirely. Full writeup in [docs/known-issues.md](../../../known-issues.md); the pattern is worth watching for in any future feature that shows a native `confirm()`/`alert()` and then expects continued `<select>` interaction in the same view. Re-verified via `typecheck`/`lint` after the fix, not yet re-confirmed live by the user.

