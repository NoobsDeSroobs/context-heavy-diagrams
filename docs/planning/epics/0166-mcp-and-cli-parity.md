# 0166: The MCP server and the command line share their checks

## Status
Not Started. Implements [ADR 0138](../../decisions/0138-the-mcp-server-carries-the-guidance-the-cli-carries-the-checks.md).

## Goal
Every check lives once in shared code and is reachable from `chd`; the MCP server exposes the ones an assistant needs while it works, with identical results; a test fails if the two disagree.

## Where it stands
| Capability | `chd` command | MCP tool |
|---|---|---|
| Format rules | `chd spec [topic]` | `get_format_spec` |
| Validate | `chd validate` | `validate_diagram`, and validation on every write |
| Fingerprint | `chd hash` | returned by `read_file` |
| Conformance check | `chd check` | none |
| Review of changes | `chd diff` | none |
| SVG export | `chd export` | none |

## Scope
- Add MCP tools for the conformance check and the diff, so an assistant without a shell can use them. Export belongs with [0167](0167-assistants-can-see-their-own-output.md).
- Move any logic that exists only in one front door into shared code, so each is a thin wrapper.
- A parity test runs both front doors over the same set of diagrams and compares results.
- The server does not mirror commands only a pipeline needs (`--version`, recursive batch runs). The command line stays the authority for CI, and the tool descriptions say that a pass in a session is advice.

## Tasks
- [ ] Inventory what each front door does and where the logic lives today
- [ ] Shared operations module for validate, check, diff and the fingerprint
- [ ] MCP tools `check_diagram` and `diff_diagrams`, with the same output shape as `--json`
- [ ] The parity test
- [ ] Update the extension's instructions and the skill so the assistant knows which tool replaces which command
- [ ] The `chd mcp` launch command is part of [0159](0159-ai-menu-for-more-than-claude.md)

## Notes
Raised in the design discussion that became ADR 0138.
