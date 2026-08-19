# 0030: Custom style palettes & default element styles

## Status
Not Started — not yet scoped. Raised by the user while reviewing epic 0003 (styling panel); deliberately not designed here, just captured so it isn't lost. Needs a real design pass before implementation, same as epics 0024/0026.

## Goal
Two related, naturally-sequenced features on top of epic 0003's property panel and pickers:

1. **User/organization-owned style palettes** — a saved set of colors and fonts (not just the single-color-at-a-time fields that exist today), surfaced as a distinct group inside the existing color fields (Fill/Border/Font color, in both the property panel and the Fill…/Border… context-menu popups) and the Font Family dropdown. The stated motivation: "company palettes" — a team's brand colors and approved fonts, reusable across diagrams. "Custom style palette" is a placeholder name; the user explicitly invited a better one once this gets designed.
2. **Default styles for newly-created elements** — shapes/containers/text/edges currently spawn with no `style` at all (today's fully-hardcoded look, per ADR 0014). This asks for a configurable default `NodeStyle`/`EdgeStyle` applied at creation time instead, most naturally expressed as designating something (a palette entry, or a whole saved style) as "the default" — which is why this is filed alongside the palette idea rather than separately, though the two are technically separable if that turns out to matter.

## Relationship to existing decisions
- **Distinct from [ADR 0010](../../decisions/0010-named-searchable-style-presets.md)'s named preset catalog**: ADR 0010 is a *tool-curated* catalog of line-style/marker conventions (searchable by keyword, ships with the app). This epic is *user-curated* — colors and fonts someone adds themselves, closer in spirit to [ADR 0009](../../decisions/0009-custom-metadata-bucket.md)'s "standard vs. custom" split (tool-managed vs. user-owned) than to ADR 0010's picker mechanism. Worth being precise about which is which when this gets designed, same caution ADR 0010 itself already flagged for a related distinction.
- **Builds on epic 0003**'s property panel and `ColorField`/`SelectField` — this is additive UI on top of those, not a rebuild.
- **Nearest existing precedent for a "shareable resource pack"** is [epic 0019](0019-installable-icon-packs.md) (installable vendor icon packs) — different domain (redistributable third-party assets vs. user-authored palettes) and currently blocked on licensing, but worth a look for any reusable "pack" concept when this is designed.

## Decided
- **Storage/sharing model.** Palettes are configured/edited directly in the app (a "live" working copy — most likely per-app-user storage, e.g. Electron's OS user-data dir, though where exactly is still a detail for the design pass), with explicit **export to a file** and **import from a file**. A company builds its palette once, exports it, and distributes that file (git, shared drive, email — this app has no opinion, same as it has none about how `.chd` files themselves get shared); anyone imports it to get the same colors/fonts locally. This sidesteps needing a live-shared-file-path/sync mechanism entirely — sharing happens by handing someone a file, the same plain-files philosophy every other feature in this app already follows. The exported file's exact format isn't decided (a JSON file, fixed key order for clean diffs, is the obvious default matching `.chd`'s own conventions) but the mechanism is.

## Real open questions (deliberately not resolved here)
- **Multiple palettes vs. one** — can several be imported/active at once (e.g. "Personal" + "Acme Corp" side by side), or does importing replace whatever's there? If multiple, do they need names to tell apart in the picker groups?
- **Import behavior** — merge into the existing palette, or replace it outright? Does re-importing an already-imported file update in place or duplicate?
- **How a palette gets edited in-app** — a dedicated settings/management screen? Inline "add to palette" from a color already picked somewhere?
- **Exact surface area** — every `ColorField` (Fill/Border/Font, panel and context-menu popups) and the Font Family `SelectField` seems clear; does the edge line-style/marker picker (ADR 0010) also grow a custom/company section, or does this epic stay color-and-font-only and leave line-style presets as ADR 0010's separate built-in-only catalog?
- **How defaults are set and scoped** — one default per element type (shape/container/text/edge)? Multiple named presets/"themes" to switch between? Set via a dedicated action, or implicitly ("last used becomes default")?
- **Naming** — "custom style palette" is a placeholder, per the user's own invitation to find something better once this is actually designed.

## Notes
Not scheduled into the current batch (see [PROGRESS.md](../../../PROGRESS.md)) — flagged here so it's on the backlog and not lost, not because it's next up.
