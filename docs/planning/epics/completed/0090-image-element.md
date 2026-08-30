# 0090: Reference images attached to shapes

## Status
In progress (2026-08-27) — on `batch/2026-08-27-backlog-cleanup-2`. Design settled with the user this session; see [ADR 0069](../../../decisions/0069-reference-images.md).

## Goal
Let the user attach one or more images to a **shape** as *reference material* — a screenshot, a logo, a diagram fragment, a photo of a whiteboard — viewable in a floating, closable panel while working, **never rendered on the canvas or included in exports**. This is the PureRef / design-software reference-board model, not "an image as a diagram element."

Originally raised (2026-08-24, again 2026-08-27) as "paste/add an image as its own canvas element." Reframed this session: an image-as-element competes with shapes for meaning; a reference is unambiguously scaffolding, and matches the stated use case ("images in the diagram for reference while working").

## Settled design (see [ADR 0069](../../../decisions/0069-reference-images.md))
- **Attach point: a shape (or container) only.** The shape represents a concept; everything hangs off it. No diagram-level reference pool in v1.
- **Schema:** `DiagramNode.data.references?: string[]` — ordered relative asset paths, same portability rules as `data.details`. The *only* persisted state; panel open/position/size is transient session state (a View, per [ADR 0052](../../../decisions/0052-settings-ownership-tiers.md)).
- **Storage:** `<diagram-base>/assets/references/` sibling subfolder, copy-on-add, relative path stored, **requires a saved diagram** (same limitation custom icons accept, [ADR 0006](../../../decisions/0006-icon-storage-model.md)). New `src/main/references.ts`, modelled on `icons.ts`. Rendered `<img src="data:…">`, never inline SVG.
- **Add method:** native file picker only (png/jpg/jpeg/gif/webp/svg). Paste-from-clipboard and drag-and-drop split to [epic 0097](../0097-paste-and-drop-reference-images.md).
- **Geometry:** the floating viewer panel resizes aspect-locked, does not rotate.
- **Visibility:** references never appear on the canvas and are excluded from PNG export — working aid only.
- **Diagram-wide inventory:** a read-only "References" View in `UtilityDock` (LayerPanel-shaped) listing every reference across all shapes; click an entry to select + focus its owning shape.
- **Deferred to follow-ups:** configurable asset paths ([epic 0098](../0098-configurable-asset-subfolder-paths.md)); `has:references` search facet, combinable with tag search ([epic 0099](../0099-search-by-reference-presence.md)); pop-out to a real OS window; per-image captions.

## Tasks
- [ ] `src/shared/diagram.ts`: `data.references?: string[]`; `docs/file-format.md` updated.
- [ ] `src/main/references.ts` + preload: `references:pickAndCopy`, `references:readAsDataUrl`; registered in `src/main/index.ts`.
- [ ] `PropertyPanel.tsx`: a "References" section for a single shape/container — thumbnail list, Add…, remove, "Show references" button.
- [ ] `ReferenceViewerPanel.tsx` (new): floating, draggable, aspect-locked-resizable, closable; one per shape; several open at once. State in `Canvas.tsx`.
- [ ] `ReferencesPanel.tsx` (new): the diagram-wide inventory View; joins the `UtilityDock` mutually-exclusive family; a View-menu item.
- [ ] `Canvas.tsx` / `DiagramContext`: thread reference state; `remapForPaste` handling; exclude from `captureDiagramPng`.
- [ ] `npm run typecheck` / `npm run lint` clean.

## Notes
Follow-up epics logged this session: [0097](../0097-paste-and-drop-reference-images.md), [0098](../0098-configurable-asset-subfolder-paths.md), [0099](../0099-search-by-reference-presence.md).
