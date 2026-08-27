# 0069: Reference images attached to shapes

## Status
Decided (2026-08-27), implementation in progress.

## Context

An image element was raised twice as "let the user add a raster/vector image as its own canvas element (paste or file picker)." Working through it with the user, the framing changed: an image sitting on the canvas as a first-class element competes with shapes for meaning — a reader can't tell whether a box is part of the architecture or just a pasted screenshot. What the user actually wants is *reference material* visible while working — the PureRef / Photoshop reference-panel model. That reframing resolves the ambiguity cleanly and is what this ADR settles.

## Decision

**1. A reference is scaffolding, never diagram content.** Reference images:
- never render on the canvas,
- are excluded from PNG export (`captureDiagramPng`),
- only ever appear inside floating viewer panels the user opens and closes at will.

This single line is what makes the concept coherent — the moment a reference can be "pinned" onto the canvas it collapses back into the image-element idea that was rejected.

**2. Attach point: a shape or container node, via `DiagramNode.data.references?: string[]`.** An ordered list of relative asset paths, same shape and portability rules as `data.details`. No diagram-level reference pool — the shape represents the concept and everything hangs off it. A diagram-wide *view* of all references exists (Decision 5) but there is no diagram-level *storage*.

**3. The list is the only persisted state.** Which viewer panels are open, where they are dragged, how big they are — transient session state, not written to `.chd` or `AppSettings`. This is a View in [ADR 0052](0052-settings-ownership-tiers.md)'s sense (owns no state), same as Layers/Diagnostics.

**4. Storage mirrors custom icons ([ADR 0006](0006-icon-storage-model.md)) exactly.** Copy-on-add into `<diagram-base>/assets/references/`, store the relative path, render via `<img src="data:…">` (never inline SVG — the same script-injection guard). New `src/main/references.ts` modelled directly on `icons.ts` (`references:pickAndCopy`, `references:readAsDataUrl`). Adding a reference **requires the diagram to already be saved** — same accepted limitation custom icons have, for the same reason (no sibling folder to copy into otherwise). Removing a reference from the list drops the association only; the file on disk is left, same as details/icons never hard-delete.

**5. A read-only diagram-wide "References" inventory View**, LayerPanel-shaped, in the `UtilityDock` mutually-exclusive family. Lists every reference across every shape (thumbnail + owning shape's label); clicking an entry selects and focuses the owning shape. A live projection of `nodes`, no catalog of its own — exactly what that dock already does for Layers.

**6. File picker only for v1.** png/jpg/jpeg/gif/webp/svg. The "paste" in the original framing (OS-clipboard image via `clipboard.readImage()`) and drag-and-drop are real but separate plumbing — split to their own follow-up.

**7. Viewer geometry: aspect-locked resize, no rotation.** It's a picture; distorting or rotating it serves no purpose here.

## Alternatives considered

- **Image as a first-class canvas element** (the epic's original framing) — rejected; see Context. The `"image"` node type, connection points, canvas rendering, and export inclusion all fall away with it.
- **Diagram-level reference pool with per-shape tagging** ("search `hasPicture = true & tag=GDPR.PII`") — the user's own richer idea. Deferred: the pool + tagging model is its own piece of work, and a `has:references` search facet extends search's matching the same way search-by-icon does — logged as its own follow-up. Per-shape `string[]` is the v1.
- **Configurable `assets/` / `assets/references/` subfolder paths** — deferred to a separate follow-up; it needs a settings field threaded through every asset read plus a migration story for existing diagrams, none of which belongs here. Hardcoded `assets/references/` for now, consistent with the hardcoded `assets/` for icons.
- **Pop-out to a real always-on-top OS window** (true reference-software behaviour) — a natural later step, much more plumbing (new window type, asset IPC into it). In-canvas floating panel for v1, reusing the existing overlay pattern.
- **Embedding image bytes in the `.chd`** — rejected outright; a few screenshots would bloat the file to megabytes of single-line base64, breaking the "git-friendly plain text" goal.

## Consequences

- `src/shared/diagram.ts`: `data.references?: string[]` — additive, optional, no `.chd` version bump (same "absent means none" convention as every other `data.*` field). `docs/file-format.md` gains the field.
- `src/main/references.ts` (new), registered in `src/main/index.ts`; preload gains `pickAndCopyReference` / `readReferenceAsDataUrl`.
- `PropertyPanel.tsx`: a "References" section for a single shape/container selection.
- `ReferenceViewerPanel.tsx` (new, floating) and `ReferencesPanel.tsx` (new, `UtilityDock` inventory View); `Canvas.tsx` holds the open-viewers state and a `referencesPanelOpen` flag.
- `captureDiagramPng` unaffected because references never mount on the canvas — no explicit exclusion code needed, but there is a test note to confirm it.
- `remapForPaste`: copying a shape carries its `references` paths as-is (they're diagram-relative and the paste target is the same diagram) — no re-copy needed; cross-diagram paste is already out of scope for the clipboard feature.
- Three follow-ups logged: clipboard paste + drag-and-drop for reference images, configurable asset subfolder paths, and a `has:references` search facet.
