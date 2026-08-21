# Self-documentation (dogfooding)

This tool's own architecture, documented using nothing but its own features. The only folder in the gallery that's about this tool itself rather than fictional content.

## Planned entries (not yet built)

- **Technical view** — a C4-style Context → Container → Component drill-down using linked-diagram navigation (epic 0009): top-level context diagram → a "process model" container diagram (main / renderer / preload) → component-level diagrams (`diagram.ts` / `icons.ts` / `details.ts` / `links.ts` and their IPC channels). Deliberately the strongest showcase of linked-diagram navigation.
- **Functional view** — a user-journey/flow diagram (open/create → add shapes/text → style → icon → link → details → save), edges-as-sequence rather than hierarchy. Deliberately a different diagram *shape* from the technical view, to exercise a different part of the tool.

Both should be cross-linked from wherever the example index/README ends up living once built.

## Status

Nothing built yet. See [epic 0022](../../../docs/planning/epics/0022-example-diagram-gallery.md)'s Self-documentation section.
