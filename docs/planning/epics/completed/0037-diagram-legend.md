# 0037: Diagram legend

## Status
Done, pending PR/merge. Implemented and confirmed working in the running app by the user (2026-08-21) on `epic/0037-diagram-legend`, including a same-day follow-up fix to swatch sizing/layout after the user's first manual look. Scoped and designed the same day (see [ADR 0033](../../../decisions/0033-diagram-legend-design.md)). Raised by the user (2026-08-20) while reviewing the first real gallery diagram ([epic 0022](../0022-example-diagram-gallery.md)'s C4 context example) — the diagram uses fill color to distinguish the in-scope system from actors from external systems, and a dashed edge to flag a transitional/being-retired relationship, with nothing in the diagram explaining what those visual conventions mean.

## Goal
A legend capability: a way to explain what a diagram's colors, edge styles (line style, markers), and icons mean, without relying on the reader already knowing the convention or the diagram author explaining it out of band. Surfaced directly by dogfooding — this is exactly the kind of gap epic 0022 exists to find.

## Decided
See [ADR 0033](../../../decisions/0033-diagram-legend-design.md) for full reasoning. Summary:
- **Structured, not freeform** — a real editing UI (add-entry flow, not hand-typed prose in a text node), same spirit as the original framing below.
- **One flat entry type**, `{ id, kind: 'line' | 'icon' | 'shape', label, color? }` — `kind` decides which extra fields apply (`line`: `lineStyle`/`startMarker`/`endMarker`; `icon`: an `IconRef`; `shape`: nothing beyond `color`). `color` never applies to `icon` entries (icons aren't tintable in this app). `shape` renders as a circle, deliberately not a box, to avoid implying the meaning only applies to rectangular shapes.
- **Manually authored, independent of the highlights catalog** — no auto-population or cross-reference, since most legend entries (e.g. "dashed = planned") have no backing metadata at all.
- **Split persistence, same shape as highlights**: the catalog (`DiagramFile.legend`) is saved; whether the panel is currently shown is session-local, default closed, never saved.
- **Placement**: a `ControlButton` inside React Flow's bottom-left `<Controls>` (zoom/fit/lock), opening a small floating panel next to it — not the right-side `UtilityDock` shell every other panel (Highlights/Required tags/Diagnostics/Settings) uses.

## Implementation checklist
- [x] Schema: `LegendEntryKind`/`LegendEntry`/`DiagramFile.legend` in `src/shared/diagram.ts`, wired into `serializeDiagram`.
- [x] `docs/file-format.md`: new Legend section, top-level fields table entry, Versioning line.
- [x] `Canvas.tsx`: `legend` state (load/save, same shape as `highlights`), `legendPanelOpen` session state (default closed).
- [x] `LegendPanel` component: row list (swatch + label + remove), "Add entry" flow branching by kind into `StylePicker` (line), a new compact `LegendIconPicker` reusing the builtin/custom icon data sources (icon), or a plain color input (shape), plus a label text field.
- [x] Swatch rendering per kind: small line/arrow SVG (reusing `markerUrl`, plus a local `DASH_ARRAY` copy) for `line`, `IconSlotView` for `icon`, a plain colored circle for `shape`.
- [x] `ControlButton` added to `<Controls>` in `Canvas.tsx`, toggling the panel.
- [x] Typecheck/lint clean (new code has zero lint issues; the only pre-existing error and the CRLF warnings across the touched files predate this epic — `core.autocrlf` on this machine, unrelated to legend work).
- [x] Sanity-check in the running app — done by the user, who flagged the dashed-line swatch being too small to read as dashed; fixed same-day (swatches enlarged, per-row color box replaced with an invisible click-to-edit overlay on the swatch itself, labels wrap in place).

## Notes
Until this landed, gallery diagrams needing to explain a color/line convention used an in-canvas blurb text node (epic 0022's Notes) as a known-temporary stopgap — not a model for what the real legend looks like.
