# 0098: Configurable asset subfolder paths

## Status
Not Started — split off [epic 0090](0090-image-element.md) (2026-08-27, [ADR 0069](../../decisions/0069-reference-images.md)).

## Goal
Today the sibling-folder layout for a diagram's attachments is hardcoded: custom icons go in `<diagram-base>/assets/`, reference images (epic 0090) in `<diagram-base>/assets/references/`, detail files in `<diagram-base>/details/`. The user wants these relative paths configurable — e.g. an `AppSettings` field (or per-diagram Configuration?) for the assets subfolder.

## Open questions
- Settings (per-install) or Configuration (per-diagram)? A per-diagram override matters if collaborators disagree on layout; a per-install setting is simpler.
- Migration: every existing diagram assumes `assets/` / `details/`. Changing the setting can't silently orphan already-copied files — does it move them, or only affect new copies?
- Which paths are covered — just `assets/`, or `details/` too? The icon path and the reference path independently, or one "attachments root"?
- Every asset read (`icons.ts`, `references.ts`, details loading in `Canvas.tsx`) needs the resolved path threaded through instead of a local constant.

## Notes
Deliberately kept out of epic 0090 — it's a settings + migration change touching existing icon behaviour, not part of shipping reference images.

If [epic 0104](0104-central-custom-icon-library.md) (central custom-icon library) lands first, this epic's scope shrinks to reference images + detail files — custom icons would no longer live in a per-diagram subfolder at all. Decide the order before starting either.
