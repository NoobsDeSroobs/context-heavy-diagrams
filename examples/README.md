# Examples

Real, working diagram files, kept as manual regression fixtures and as a starting point for anyone trying the tool out. Each is a single `.chd` file (plain JSON underneath) — see [docs/decisions/0005-diagram-identity-and-linking.md](../docs/decisions/0005-diagram-identity-and-linking.md) for the file model. An example only gets a sibling folder (`<name>/assets/`, `<name>/details/`) once it actually demonstrates a feature that needs one.

- **`hello-world.chd`** — the minimal case: two nodes, one edge. Proves save/load round-trips correctly.
- **`with-icons.chd`** — two shapes with built-in corner icons (epic 0007).
- **`with-metadata.chd`** — a diagram-level `requiredTags` template plus one required tag and one free tag on a node (epic 0034/ADR 0022).

These three are minimal regression fixtures, not a feature showcase — a real gallery (containers, linked diagrams, highlights, multi-view compliance overlays, one per architect discipline) is [epic 0022](../docs/planning/epics/0022-example-diagram-gallery.md)'s job, not yet started. Expect a dedicated `examples/gallery/` subfolder once that begins, per that epic's own Notes, so the two purposes (round-trip fixtures here vs. a showcase there) don't get confused.
