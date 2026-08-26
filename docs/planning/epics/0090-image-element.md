# 0090: Paste/add an image element

## Status
Not Started — idea only, not yet scoped

## Goal
Let the user add a raster/vector image as its own canvas element (paste from clipboard, or add via file picker), not just as a corner icon annotation on a shape (epic 0007) or a future large-icon node type ([epic 0051](0051-non-rectangular-shapes-and-new-item-categories.md)). Likely use case: dropping in a screenshot, logo, or diagram fragment that isn't meaningfully a "shape."

## Relationship to existing infrastructure (not resolved here)
- Custom icon upload already has most of the low-level plumbing this would need — file picker filtered to `.svg`/`.png`, copy into the diagram's sibling `assets/` folder, `<img src="data:...">` rendering rather than inlining an arbitrary SVG (security: an uploaded SVG could embed a script) — see [ADR 0006](../../decisions/0006-icon-storage-model.md) and `src/main/icons.ts`. A new image node type would likely reuse this asset-storage convention rather than inventing a new one.
- Distinct from [epic 0051](0051-non-rectangular-shapes-and-new-item-categories.md)'s "iconography category" (large icon-only nodes drawn from the *built-in/custom icon system*) — this is about an arbitrary user-supplied image as a first-class element, not an icon reference.
- "Paste" specifically implies clipboard-image support, not just file-picker upload — this app's clipboard handling today (epic 0025/ADR 0049) is plain-text JSON only (`clipboard.ts`), so pasting a real image (e.g. copied from a browser or screenshot tool) would need new handling entirely separate from the existing node/edge copy-paste path.

## Open questions — not yet discussed with the user
- New node type (`"image"`), or a style/data variant of an existing type?
- Resizable/rotatable like Text, or fixed-aspect like a Shape? Does it keep icon slots, connection points?
- Paste-from-OS-clipboard needs Electron's `clipboard.readImage()` (native image, not text) — a different code path than the existing `readClipboardText()`.

## Notes
Raised by the user 2026-08-24 alongside two other new ideas (0089, 0091), logged without further design discussion.

Raised again 2026-08-27 ("Adding Images like PNGs to the overview"), alongside [epic 0094](0094-search-by-icon.md) — same idea, no new scope beyond what's already captured above. Two independent mentions three days apart is a mild signal this is worth picking up before some of the older, once-mentioned backlog items, though still not formally reprioritized.
