# 0097: Paste and drag-and-drop for reference images

## Status
Not Started — split off [epic 0090](0090-image-element.md) (2026-08-27, [ADR 0069](../../decisions/0069-reference-images.md)). Depends on 0090 landing first.

## Goal
Add two more ways to attach a reference image to a shape, beyond 0090's file picker:
1. **Paste** — Ctrl/Cmd+V of a real image from the OS clipboard (a screenshot, an image copied from a browser) onto a selected shape. Needs Electron's `clipboard.readImage()` (a native image, not text) — a code path entirely separate from today's text/JSON clipboard handling (`clipboard.ts`, epic 0025/ADR 0049). The pasted bytes get written into `assets/references/` with a generated name (`pasted-<timestamp>.png`).
2. **Drag-and-drop** — drag an image file from the OS file manager onto a shape (or onto an open reference viewer panel) to attach it.

## Open questions
- Paste currently routes through the node/edge copy-paste path — how to disambiguate "image on clipboard" from "diagram elements on clipboard" (check `readImage()` first? only when the text payload isn't our JSON?).
- Drop target: the shape under the cursor, the canvas generally (then which shape?), or only an already-open viewer panel.
- Still requires a saved diagram (same `assets/` limitation as 0090).
