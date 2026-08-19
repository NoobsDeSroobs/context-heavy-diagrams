# 0003: Styling panel

## Status
Not Started

## Goal
A properties panel that appears when a node/edge is selected, driving manual style fields: line type, thickness, colour, fill, etc. — plus, per [ADR 0010](../../decisions/0010-named-searchable-style-presets.md), a right-click-accessible, searchable catalog of named/industry-standard style presets (edge line+marker combinations especially), so picking "Dependency (UML)" or "One-to-many (ERD)" is possible by name and keyword, not just by recognizing a visual swatch.

## Tasks
- [ ] Finalize style fields on the node/edge schema (see edge schema open item in [project brief](../../project-brief.md)) — for edges, this needs new `startMarker`/`endMarker` fields (independent per end — see ADR 0010) alongside line style/color/thickness
- [ ] Properties panel UI, shown on selection — source of truth for exact manual control (specific hex color, exact stroke width)
- [ ] Panel edits write through to node/edge `style` data and re-render live
- [ ] Built-in named style preset catalog (new module alongside `src/renderer/src/icons/builtinIcons.ts`, e.g. `builtinLineStyles.ts`), each entry a label + search keywords + the raw style it applies — see ADR 0010 for the initial coverage list (generic, UML, ERD/crow's-foot, process/flow) and why presets are never stored as an identity on the edge, only applied as raw properties
- [ ] Right-click context-menu entries — "Fill…" / "Border…" on shapes, "Line style…" on edges — opening popups reusing the existing `IconPicker`-style fixed-positioned, searchable popup pattern. Complementary to the properties panel, not a replacement: same underlying raw fields, just a faster/discoverable entry point for picking a named preset
- [ ] Text alignment for shape/text labels (start/center/end — use CSS logical values, not left/right, for RTL correctness). Moved here from epic 0012, which needs this panel to exist before the setting is reachable at all.

## Notes
See [ADR 0010](../../decisions/0010-named-searchable-style-presets.md) for the full reasoning behind the named-preset catalog and the panel/context-menu split. Expect the preset catalog to grow driven by real gaps found while working through epic 0022's diagram-type gallery (an ERD example needs crow's-foot markers that don't exist yet, etc.) rather than trying to enumerate every notation system upfront.
