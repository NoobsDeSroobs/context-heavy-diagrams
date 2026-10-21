# 0145: Read-only HTML export

## Status
Not Started. Logged 2026-10-21 from the [comparison with other tools](../../comparison.md). Sparse on purpose: to be reviewed and discussed before any decision to build it.

## Goal
Export a diagram, with its linked diagrams, as a self-contained page that a reader without the app can open: pan and zoom, follow drill-down links, read the notes and switch highlights on and off.

## Why
There is no way to share a diagram with someone who does not have the app, apart from a PNG. A page could also be published as a static site or attached to a wiki.

## Open questions
- Whether it can share the renderer chosen in [epic 0144](0144-svg-and-command-line-export.md); probably it should wait for that.
- How much interactivity is worth having (highlights, search, notes) against a plain page of SVG.
- Whether it is one file or a folder, and how linked diagrams and notes are included.
- How it relates to the offline rule: the page itself must make no network requests either.

## Related
[Epic 0144](0144-svg-and-command-line-export.md), [epic 0114](later/0114-android-diagram-viewer.md) (another reader-only view).
