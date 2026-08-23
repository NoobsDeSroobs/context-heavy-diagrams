# 0074: Multiple named style palettes, with an active-palette selector

## Status
Not Started — not yet scoped. Raised 2026-08-23 alongside [ADR 0052](../../decisions/0052-settings-ownership-tiers.md), while mid-implementation of epic 0054.

## Goal
The style palette (epic 0030/ADR 0048) stays Settings-only per [ADR 0052](../../decisions/0052-settings-ownership-tiers.md) — no diagram-local copy, since a shape's actual color is already captured at the Properties level. What's missing: today there's exactly one active palette, and importing a file *replaces* it outright (`settings.ts`'s own comment: "One active palette, not several merged ones"). The user wants to keep several named palettes around at once — e.g. "Company," "GDPR," "Client" — and switch which one is active via a dropdown, rather than overwrite-on-import. Sharing a palette with someone else already works today (`stylePalette:exportToFile`/`importFromFile`) and doesn't need to change — this epic is purely about managing several of them locally.

## Real open questions (deliberately not resolved here)
- Data shape: `AppSettings.stylePalette: { colors, fonts }` (singular) needs to become a collection of named palettes plus an "active" pointer — exact shape not designed.
- Import behavior: does importing a file add a new named palette (asking for a name), or still replace whichever one is currently active? The single-palette "replace outright, confirmed in-panel" behavior (not `window.confirm()` — see `docs/known-issues.md`) was deliberate; needs revisiting for a multi-palette world.
- Where the active-palette dropdown lives — `StylePalettePanel` itself, or somewhere more prominent (top menu bar?) since it's meant to be switched between more casually than editing colors is.
- Creating a brand-new empty palette vs. duplicating the currently-active one as a starting point — not decided.

## Notes
Depends on [epic 0054](0054-os-conventional-settings-storage.md) landing first (or at least its `AppSettings` shape being stable) — this reshapes a Settings field and shouldn't happen mid-migration.
