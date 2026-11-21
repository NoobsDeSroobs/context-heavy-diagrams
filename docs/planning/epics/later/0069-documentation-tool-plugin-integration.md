# 0069: Plugin/integration for common documentation tools

## Status
Not Started — not yet scoped, explicitly far out. Raised by the user (2026-08-23) alongside deciding the SVG/PNG export batch (epic 0010): once export exists, the natural next thought is a tighter integration than "export a file, upload it by hand" — but the user was explicit this is "for muuuuch later," logged so it isn't lost, not to be designed or built now.

## Goal
Some form of plugin or integration letting a diagram (or a view of one) be embedded/synced into common documentation tools — Confluence was the example that prompted this, raised in the same breath as epic 0010 (SVG/PNG export, which covers the simple "export and upload by hand" case this would go beyond).

## Notes
Nothing scoped: not which tool(s) first, not whether this means a Confluence/Notion/etc. plugin calling out to this app, an export format tailored to one tool's macro system, a live-updating embed, or something else entirely. Purely a placeholder so the idea isn't lost before epic 0010 (the immediate, much smaller ask) is picked up.

Update 2026-11-21: the maintainer wants a spike soon to gauge the different integrations and what each costs and gives. For each candidate: what it needs from this app, whom it serves, the effort and the upkeep. The app stays offline ([ADR 0113](../../../decisions/0113-enforced-offline-behaviour.md)), so an integration is a plugin or a file step in the other tool, working from `chd export` and the file format, not code in the app that calls out. The result is a short comparison, then an ADR for any that go ahead.
