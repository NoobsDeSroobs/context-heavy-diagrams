# 0164: Tooling fixes from the first assistant trial runs

## Status
Not Started.

## Goal
Close the small gaps that two trial runs, an assistant drawing a large open-source project through the folder route and through the MCP server, found in the validator, the MCP server and the guidance. Each is a fix, not a design.

## Fixes
1. **The validator checks edge handles.** An edge whose `sourceHandle` or `targetHandle` is not one of the node's stored connection points is not drawn, and nothing reports it. The same class of bug had to be repaired by hand in the gallery. Applies to the skill's validator, `chd validate` and the MCP `validate_diagram`, which should give the same answer ([ADR 0138](../../decisions/0138-the-mcp-server-carries-the-guidance-the-cli-carries-the-checks.md)).
2. **The legacy node type `shape` is flagged.** The app reads it as `entity`, so the validator passes it silently, and one trial run wrote it on 54 nodes. Warn on it in new files, and reword the layout guide's "Shape (entity)" and "shapes" so the guidance never suggests the old name.
3. **The MCP server says which folder it serves.** The listing shows only relative names, so an assistant whose server pointed at the wrong folder had to search the disk to find out. Return the folder's name (not its full path, which would go to the provider) with the listing.
4. **`get_format_spec` with `all` is too large** (about 66 KB) and hit a client's output limit. Make `all` return the core rules and an index of the topics, or split the output, and say in the tool description to read topic by topic.
5. **Say what a provenance path is relative to.** When an assistant tags elements with the file they come from, two runs chose different bases. The authoring guide recommends paths relative to the folder the assistant was given and, if it uses another base, records it in the diagram's `metadata`.
6. **The folder route tells the assistant the truth about `chd`.** The skill tells an agent to run `chd hash`, `chd diff` and `chd check`, but the setup fills the CLI note into `AGENTS.md` only when the app knows where its `chd` is, and in one trial the note was missing and `chd` was not on the path. Find out why the path was unknown, and when `chd` is unavailable say so in the note and have the skill fall back to re-reading the file.

## Tasks
- [x] Handle check in the shared validator, with tests for a stored-points node, a plain side on a node with no stored points, and a missing node
- [x] Warning for `type: "shape"`; reword the layout guide
- [x] Folder name in the MCP listing
- [x] Shrink or split `get_format_spec all`
- [x] Provenance-path convention in the authoring guide, mirrored in the skill, `AGENTS.md` and the extension's spec text
- [x] Why the CLI note was dropped in the trial; the unavailable-`chd` wording
- [x] Add the handle-check bug class to [known-issues](../../known-issues.md)

## Notes
Built on the branch `epic/0164-tooling-fixes` (2026-11-04). The handle check reads `connectionPoints` from the node itself, not from `data`; running it over `examples/` caught that. The trial's missing CLI note could not be traced for certain: the note is empty in a run from source, an AppImage and every macOS build (the mac build has no launcher), while an installed Windows build has one, so a dev run is the likely cause. The note now always says whether `chd` exists, and the skill says what to do without it.

Raised from the trial runs. The project they used is not named here; the runs and their write-up are kept out of the repository for now. Minimum spacing between connected elements is [0162](0162-minimum-distance-between-connected-elements.md).
