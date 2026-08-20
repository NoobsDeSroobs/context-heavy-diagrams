# 0036: Grouped highlights

## Status
Done, merged to `master` (#21). User confirmed after testing: "Tested, and everything seems to be working." Originally logged as "key-level highlight scales" during epic 0026's design, deliberately left undesigned at the user's request; the user came back with a simpler idea that fully supersedes the original framing — see [ADR 0026](../../decisions/0026-grouped-highlights.md).

## Goal
An "Add group" action in the Highlights panel: pick a tag key (e.g. `GDPR`) and the app auto-generates one ordinary highlight per distinct value already used for that key somewhere in the diagram (`Not relevant`, `Pseudonymous`, `PII`, `Sensitive PII`, …), displayed together under a collapsible group header with its own bulk on/off checkbox, while each value keeps its own individual checkbox and color underneath. Lets a whole tag's value space be toggled with one click, or narrowed down to just one value, without hand-building N separate highlights one at a time.

## Design
Resolved via direct discussion with the user, no open questions remaining — see [ADR 0026](../../decisions/0026-grouped-highlights.md) for full reasoning:

- **Pure display grouping, no schema change.** The panel groups the existing `highlights` array by `.key`. 2+ entries sharing a key render as a collapsible group with a tri-state bulk checkbox; exactly one entry for a key renders as today's plain row.
- **"Add group" reconciles** (add missing values, remove entries for values nothing carries anymore), not append-only — confirmed against a concrete "business retires a value" scenario. Existing entries for still-used values keep their color/enabled state.
- **New entries default to white**, both via "Add group" and the existing single "Add highlight" flow (unified, replacing the old rotating default-palette behavior) — deliberately neutral so a fresh entry never accidentally collides with a color already meaning something else.
- **Reconcile is explicit, not automatic** — re-clicking "Add group" (or a small per-group resync control) triggers it; nothing silently reconciles just because metadata changed elsewhere.
- **Group checkbox is standard tri-state "select all."**

## Tasks
- [x] `highlights.ts`: `DEFAULT_HIGHLIGHT_COLOR` (`#ffffff`) and `reconcileHighlightGroup(highlights, key, currentValues)` — pure function, adds a white entry for a value not yet covered, drops an existing entry for that key whose value isn't in `currentValues` anymore, leaves everything else (including other keys) untouched.
- [x] `Canvas.tsx`: `addOrResyncHighlightGroup(key)` derives `currentValues` from the existing `usedTags` scan (no separate metadata walk needed), calls `reconcileHighlightGroup`, and prunes `enabledHighlightIds` for anything the reconcile dropped. `toggleHighlightGroup(ids, enable)` bulk-sets (not toggles) enabled state for a group's "select all" checkbox.
- [x] `HighlightsPanel.tsx`: groups `highlights` by `.key` for display via a plain `Map`, not `CollapsibleSection` (that component's header only accepts a title string — no room for a checkbox/resync button without changing a component shared with `PropertyPanel`/`MetadataSection`, so this panel got its own small local collapsible group header instead, with independent per-group collapse state). A key with 2+ entries renders as a group with a tri-state header checkbox (`indeterminate` set imperatively via a ref — there's no such JSX prop) and a ↻ resync button; exactly one entry for a key stays a plain row.
- [x] New "Add group…" flow alongside "Add highlight": a key-only inline picker listing distinct keys currently used somewhere in the diagram; picking one calls the same `addOrResyncHighlightGroup`.
- [x] Both "Add highlight" and "Add group" now default new entries to `DEFAULT_HIGHLIGHT_COLOR`, replacing the old rotating `DEFAULT_PALETTE`.
- [x] **Your manual click-through pass** — done, confirmed working. `npm run typecheck`/`lint` both clean (lint's 4 remaining errors are the pre-existing epic 0028 baseline, confirmed by file/line match).

## Notes
Not built: any way to remove an entire group in one action (remove rows individually, or disable via the group checkbox) — not requested, avoided as scope creep. Also not built: any attempt to infer a meaningful color scale from value order — deliberately rejected, see ADR 0026's Alternatives.
