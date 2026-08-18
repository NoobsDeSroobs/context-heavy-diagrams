# 0007: Icon slots

## Status
Done — further GUI/placement polish deliberately deferred, see Notes

## Goal
Per-`ShapeNode` corner icon slots (top-left/top-right/bottom-left/bottom-right), supporting both a built-in icon set and user-uploaded custom icons. See [ADR 0006](../../decisions/0006-icon-storage-model.md) for the storage/reference model.

## Tasks
- [x] Schema: `data.icons.{topLeft,topRight,bottomLeft,bottomRight}`, each an `IconRef` (`{source: 'builtin', id}` or `{source: 'custom', path}`) — additive per ADR 0003
- [x] Add Tabler Icons as a dependency, built-in icon lookup by id — used the raw-SVG `@tabler/icons` package (not `-react`) loaded lazily via Vite's `import.meta.glob`, so the ~5,130 icons aren't all bundled upfront; `src/renderer/src/icons/builtinIcons.ts`
- [x] Render occupied icon slots on `ShapeNode` at the actual corners, normal stacking order
- [x] Right-click context menu on `ShapeNode` with an "Add icon" entry — built as generic shared infrastructure (`src/renderer/src/components/ContextMenu.tsx`, `DiagramContext.tsx`), not a one-off, for epics 0008/0013 to extend
- [x] Icon picker popup (`src/renderer/src/components/IconPicker.tsx`): searchable built-in icon grid, this diagram's already-uploaded custom icons, a corner selector. No opacity/other style params, per direction — deferred to epic 0003
- [x] Custom icon upload: file picker filtered to `.svg`/`.png`, copies into the diagram's sibling `assets/` folder (`src/main/icons.ts`), requires the diagram to already be saved — shows an alert rather than silently failing if not yet saved. Built-in icons render as trusted inline SVG; custom icons render via `<img src="data:...">` instead — never inlined, since an arbitrary user-supplied SVG could embed a script
- [x] Update `docs/file-format.md` with the new `icons` field
- [x] Add `examples/with-icons.chd` (kept `hello-world.chd` minimal rather than adding icons to it)
- [x] Manual test: add both a built-in and a custom icon, confirm rendering and save/load round-trip — confirmed, everything working

## Notes
Vendor icon packs (AWS/Azure/GCP) are explicitly out of scope — see [docs/licensing.md](../../licensing.md) and epic [0019](0019-installable-icon-packs.md).

Bugs found and fixed during testing:
- Built-in icon search returned nothing at all — the `import.meta.glob` pattern used a leading-slash "from project root" path, which actually resolved relative to electron-vite's renderer root (`src/renderer/`), not the true project root where `node_modules` lives. Fixed to a relative path from the file itself.
- No way to remove an icon once set — added a "Remove icon" button in the picker (shown when the selected corner is occupied), plus a visual "occupied" ring on that corner's dot distinct from the "currently selected" fill.
- The icon picker was rendered as a child of the shape node, inside React Flow's zoom/pan transform — it visually scaled with canvas zoom "like a shape itself" instead of staying a fixed-size UI popup, and this likely also explains reported corner-mapping confusion (a scaled/clipped/overlapping popup makes dots look like they're somewhere they're not) rather than an actual logic bug — none was found in the CSS/mapping itself on review. Fixed by moving the picker to Canvas level, fixed-positioned from the node's `getBoundingClientRect()`, same pattern the context menu already used correctly. Also repositioned to open to the right of the shape instead of below it, and restructured so only the icon grid scrolls (~3 rows) rather than the whole popup. Confirmed working after the fix.

Deferred, not blocking: general GUI/placement polish on the context menu and icon picker ("needs some work at some point" — no specifics given beyond what's already fixed above). Revisit if/when it's actually bothering day-to-day use, or naturally alongside epic 0003's properties panel work.
