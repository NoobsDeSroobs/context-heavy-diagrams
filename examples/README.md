# Examples

Real, working diagram files, kept as manual regression fixtures and as a starting point for anyone trying the tool out. Each is a single `.chd` file (plain JSON underneath) — see [docs/decisions/0005-diagram-identity-and-linking.md](../docs/decisions/0005-diagram-identity-and-linking.md) for the file model. An example only gets a sibling folder (`<name>/assets/`, `<name>/details/`) once it actually demonstrates a feature that needs one.

- **`hello-world.chd`** — the minimal case: two nodes, one edge. Proves save/load round-trips correctly.

More get added as features land — e.g. a containers example once epic 0004 exists, an iconed/detailed one once epics 0007/0008 exist — so this folder ends up demonstrating whatever the tool can currently do.
