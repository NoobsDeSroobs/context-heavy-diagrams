# 0155: End-to-end smoke test

## Status
Not Started. Follows [0154](../completed-epics.md#0154-canvas-feature-hooks).

## Goal
One automated test that launches the built app and walks the basic path, so a broken bundle, preload bridge or main-process handler shows up in CI instead of in a manual run.

## Tasks
- [ ] Choose the driver: the Chrome DevTools protocol approach in `PROGRESS.md` (no new dependency) or Playwright's Electron mode (a dev dependency); write the ADR
- [ ] Cover: launch, open a diagram, edit a label, save, reopen, export SVG, in both themes
- [ ] Run it in CI on Linux and Windows

## Notes
Covers what the unit and component tests ([0153](../completed-epics.md#0153-hook-and-component-tests)) cannot: the real main process, the preload bridge and the packaged files. The app itself stays offline ([ADR 0113](../../decisions/0113-enforced-offline-behaviour.md)); check that the driver needs no download at run time.
