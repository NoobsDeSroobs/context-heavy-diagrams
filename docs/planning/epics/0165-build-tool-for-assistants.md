# 0165: A build tool so an assistant describes a diagram and does not generate files

## Status
In progress on the branch `epic/0165-build-tool-for-assistants` (2026-11-06); design first, nothing built yet.

## Goal
An assistant gives a small description of a diagram (elements, parents, labels, tags, notes, links, edges) and a tool returns a valid `.chd` with its notes. No assistant has to write a generator script, and the result is the same on any machine.

## Why
In both trial runs the assistant wrote its own generator, about 1,000 lines each: ids, parent ordering, tags on every element, handles, key order, relative paths for notes and links, and a check that edges did not run through boxes. One run also wrote a simulated-annealing search to place a data model. A script needs a runtime the machine may not have (Node on one, Python on another, neither on a third), while the command line and the MCP server run without a system runtime ([ADR 0106](../../decisions/0106-chd-command-line-tool.md), [ADR 0110](../../decisions/0110-claude-desktop-extension.md)). Each generator also re-implements the format's traps, and one got a handle wrong.

## Shape
- One module in shared code, with two front doors: `chd build <spec>` and an MCP tool `build_diagram` ([ADR 0138](../../decisions/0138-the-mcp-server-carries-the-guidance-the-cli-carries-the-checks.md)).
- **Input:** compact JSON, generated from the same schema as the file so the two cannot drift. Elements with a label, a kind, an optional parent, tags, note text and an optional link; edges with a label, ends and tags; optional explicit positions.
- **Output:** the `.chd` and its notes, with ids, parent-before-child order, `"type": "labeled"` on edges, fixed key order, relative paths and handles that exist all handled by the tool.
- **Placement** follows the layout guide and the connected-element minimum of [0162](0162-minimum-distance-between-connected-elements.md), and reports what it could not fit. An assistant may still give explicit positions. It stays modest and does not become the parked [auto-layout](later/0126-auto-layout.md) epic.
- **Writes** follow [ADR 0109](../../decisions/0109-stale-edit-check-for-every-ai-write-path.md): creating fails if the file exists; adding to an existing diagram is conditional on its fingerprint. Editing arbitrary existing content stays with `update_file`.
- **Escape hatch:** whatever the spec cannot express (styles, line elements, edge points) still goes through the raw create and update tools, or assistants will go back to scripts.

## Risks
A second input format to maintain; placement that is merely adequate; a spec that is too small to be useful or too large to stay simple. Start from what the two generators had in common and add nothing else.

## Tasks
- [ ] List what the two trial generators computed in common; that is the minimum the spec needs
- [ ] Spec format, generated from the schema, and its documentation in the skill
- [ ] The shared build module, with tests that every output passes the validator
- [ ] `chd build` and the MCP `build_diagram`, with the parity test of [0166](0166-mcp-and-cli-parity.md)
- [ ] Placement rules, using [0162](0162-minimum-distance-between-connected-elements.md)
- [ ] Update the skill, `AGENTS.md`, the extension's instructions and the copy-paste text to prefer it
- [ ] Re-run an assistant on a large project and compare against the hand-written generators

## Notes
Raised after the first trial runs.
