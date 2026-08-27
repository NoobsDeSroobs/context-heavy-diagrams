# 0066: Gravity presets User default — resolution and UI

## Status
Decided and implemented (2026-08-27).

## Context

This adds the middle tier [ADR 0052](0052-settings-ownership-tiers.md) named (Diagram override → User default → Built-in default) to gravity/bend presets, which previously only had the outer two. This is the first concrete instance of that pattern actually being built, so the choices here are a reference point for [ADR 0067](0067-max-connection-points-diagram-override.md) and [ADR 0068](0068-multiple-named-style-palettes.md), which follow the same shape.

## Decision

**Resolution is computed live, not baked in at load time.** `effectiveGravityPresets(diagramPresets, userDefault)` now takes the Settings value as a second argument and is called fresh every render (`Canvas.tsx`'s `diagramContextValue` useMemo, with `settings.gravityPresetsUserDefault` in its deps). This answers one of the epic's own open questions — whether changing your personal default retroactively affects an already-open diagram — implicitly and for free: yes, for any diagram with no override of its own, since nothing about the resolution is snapshotted at open time. A diagram with its own override is unaffected either way, since that tier always wins regardless.

**UI: two new, symmetric buttons in `GravityPresetsPanel` — "Set as my default" and "Clear my default"** — alongside the existing "Reset to defaults" (which now reverts to the User default if one exists, or the built-in four otherwise, unchanged in behavior since it always meant "clear the diagram's own override"). "Set as my default" saves whatever's *currently shown* (`rows`, the already-resolved list) to Settings, not the diagram's raw override — so it works identically whether the diagram is customized or just showing an inherited default. The symmetric "Clear my default" was added deliberately rather than leaving only a one-way "set" action, per the project's own standing preference against asymmetric designs that later have to be reversed once the gap is noticed.

## Alternatives considered

- **Snapshotting the resolved presets once per diagram load** (so changing your Settings default wouldn't affect an already-open window) — not chosen; the live-reactive approach is both simpler to implement (no extra state to snapshot) and consistent with how every other Setting in this app already behaves (e.g. zoom limits apply immediately, not just to windows opened after the change).
- **A single "Save as default" action with no clear/reset counterpart** — rejected for the asymmetry reason above.

## Consequences

- `AppSettings.gravityPresetsUserDefault?: GravityPreset[]` — additive, optional, no migration needed (absent means "no personal default," same "absent means default" convention as everything else).
- No `.chd` schema change — this tier lives entirely in `AppSettings`, not the diagram file.
- The max-connection-points and named-style-palette follow-ups can reuse this same shape (live resolution, symmetric set/clear) rather than re-deriving it, unless a real reason to diverge shows up.
