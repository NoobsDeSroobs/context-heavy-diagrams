# 0166: The MCP server and the command line share their checks

## Status
Built on the branch `epic/0166-mcp-and-cli-parity` (2026-11-04); not merged. Implements [ADR 0138](../../decisions/0138-the-mcp-server-carries-the-guidance-the-cli-carries-the-checks.md).

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
- [x] Inventory what each front door does and where the logic lives today: validate and the fingerprint were already one implementation each (the fingerprint is two lines in two places, covered by the parity test); the conformance report and the diff report lived only inside the command-line code
- [x] Shared report modules for check and diff (`src/shared/conformance/report.ts`, `src/shared/compare/report.ts`), pure, with the command line reduced to reading files, git and printing
- [x] MCP tools `check_diagram` and `diff_diagrams`, with the same output shape as `--json`; built-in metamodels are inlined into the extension bundle like the spec text
- [x] The parity test (`src/cli/parity.test.mjs`): same results over every example and built-in metamodel, the same words for a refused metamodel, the same review with and without `--match`, the same fingerprint and validation; and a check that every `chd` command is mapped to a tool or listed as command-line only
- [x] The extension's instructions and the spec text tell the assistant which tool replaces which command, and `get_format_spec` serves the `conformance` topic
- [x] The conformance profile is renamed a diagram metamodel (`.chdmeta`, `--metamodel`, `metamodelVersion`), the old names still read ([ADR 0144](../../decisions/0144-a-conformance-profile-is-called-a-diagram-metamodel.md))
- [x] A metamodel file validates on its own: `chd validate file.chdmeta` and the server's `validate_metamodel` (`validate_diagram` stays for diagrams); the skill's guide says what to make and what the format cannot say
- [ ] `check_diagram` and `diff_diagrams` take diagram text as well as a path (and `chd check` and `chd diff` take `-` for standard input), so a candidate can be judged before it is written
- [ ] The `chd mcp` launch command is part of [0159](0159-ai-menu-for-more-than-claude.md)

## Notes
Raised in the design discussion that became ADR 0138.

Decisions taken while building it. `diff_diagrams` first compared two files only, since the extension started no program; the maintainer pointed out that this was a choice, not a limit, so it also takes a `revision` and runs the app's narrow `git show` (ADR 0142). A metamodel can be written through the server as `*.chdmeta` (ADR 0143), with no block against an assistant fitting a metamodel to its own diagram: the server cannot tell sessions apart, and judging the result is the person's job. The one difference from the command line that is by design is that the server leaves the folder's own path out of its messages.
