# 0085: Drag-select mode as a Setting

## Status
Done (2026-08-24), on `epic/0085-drag-select-mode-setting` (branched from `epic/0084-multi-connection-line`'s tip, not yet merged to `master`), not yet live-tested.

## Goal
Let the user choose between React Flow's two built-in drag-to-select behaviors — an element must be *entirely* inside the drag box (today's only prior behavior), or merely *touching* it is enough — instead of only ever getting the former. Raised after the user started relying on drag-to-select more heavily alongside epic 0084's multi-connection-line work.

## Tasks
- [x] `AppSettings.dragSelectRequiresFullEnclosure` (`shared/settings.ts`), default `true` (preserves existing behavior for anyone who already has a settings file)
- [x] Wire to `<ReactFlow selectionMode={... ? SelectionMode.Full : SelectionMode.Partial}>` (`Canvas.tsx`) — React Flow's own built-in prop, no custom selection-geometry logic needed
- [x] Checkbox in `SettingsPanel.tsx`, same pattern as the existing "Scan for unsaved diagrams on startup" toggle
- [ ] Live-test both modes — pending

## Notes
No dedicated ADR — this is a straight passthrough to a React Flow prop that already does exactly what was asked, not a real design decision with alternatives to weigh.
