# 0138: The MCP server carries the guidance, the command line carries the checks

## Status
Proposed (2026-11-02). Amends [ADR 0105](0105-bundled-ai-material-and-folder-setup.md) and [ADR 0110](0110-claude-desktop-extension.md); does not replace them.

## Context
An assistant reaches the format knowledge by three routes: pasted instructions, the folder route (a skill and `AGENTS.md` copied into the user's folder, [ADR 0105](0105-bundled-ai-material-and-folder-setup.md)) and the MCP server ([ADR 0110](0110-claude-desktop-extension.md)). The `chd` command line ([ADR 0106](0106-chd-command-line-tool.md)) serves an agent with a shell and a pipeline with no agent at all.

- The folder copy of the skill drifts: a folder set up by an older app keeps the older text until setup is run again, and the written files can clash with the user's own `CLAUDE.md` or skills.
- The server's `get_format_spec` is built from the same skill files and inlined at build time, so it always matches its app version. Its `instructions` text is in the session's system prompt without any file on disk.
- A server validates before it writes; a folder can only ask the agent to validate.
- A chat client has no shell, so it cannot run `chd`. A CI job has no assistant and no MCP server, only `chd`.

## Decision
1. **One implementation, two front doors.** The format rules, the validator, the conformance check, the diff and the fingerprint live in shared code. The command line and the MCP server are thin wrappers over it and cannot give different answers for the same file.
2. **The MCP server is complete for guidance.** The format spec (by topic, core first), the layout and authoring guidance and the working recipe reach the assistant through the server's `instructions` and tools, with nothing required in the user's folder. The server writes no `CLAUDE.md`, skill or other file of ours into the folder, so the user's own instructions and skills never collide with ours. Keep the `instructions` short and put the rest behind topics.
3. **The command line is the authority for checks.** Every check is reachable from `chd` with exit codes, so a CI job or a review gate depends on `chd validate`, `chd check` and `chd diff`, never on a result seen in an assistant session. The MCP server exposes the checks an assistant needs while it works (validate, conformance check, diff, fingerprint) with identical results, but a pass in a session is advice and a guard against writing a broken file, not a certificate. A check that exists only in the server is not allowed.
4. **Parity is by capability, not by command.** The server does not mirror every `chd` command (`--version`, recursive batch runs, anything only a pipeline needs). A test runs both front doors over the same set of diagrams and compares the results, so a check added to the shared code cannot reach one door and not the other.
5. **One launch command for any client: `chd mcp`.** It runs the same server over stdio, in a chosen folder, with no GUI, started by the client and not by the app. The Claude Desktop package ([ADR 0110](0110-claude-desktop-extension.md)) runs the same server; every other client is set up by pointing its settings at the command, so no package per client is needed. It needs the server shipped unpacked and a launcher like the `chd` one ([ADR 0106](0106-chd-command-line-tool.md)), which also gives Linux a route.
6. **The folder route stays** for agents without MCP support and for Claude Code's own features such as skills that trigger by themselves. It is not the primary route and is never required for the server to work.

## Not decided here
- **A connection between the server and the running app**, to give an assistant the open diagram, its selection and unsaved state. It would be opt-in, authenticated and loopback-only, and it needs its own design: the offline tripwire ([ADR 0113](0113-enforced-offline-behaviour.md)) forbids a Node networking module, a local port is reachable by other local processes and by web pages, and the server would have to keep the folder scope and write limits of [ADR 0110](0110-claude-desktop-extension.md). Whether it only reads the app's state or also lets an assistant's edits appear in the open window is part of that design; today an edit is a file write the person reviews afterwards.
- **Slimming the folder route** to a short `AGENTS.md` that says to run `chd spec`. That needs the launcher on a path that does not depend on the machine.

## Alternatives considered
- **Folder route as the primary route, the server as a subset.** The drift and the clash with the user's files stay, and the server's write-time validation goes unused for assistants that have both.
- **The MCP server mirrors every command and is the measuring stick.** A pipeline has no server, so a check that lives only there is not enforceable, and a pass in a session would read as a pass in CI.
- **Both routes carry the same text and neither is primary.** An assistant that has both cannot tell which to follow when they differ.

## Consequences
- Folder cleanliness and version drift are fixed on the server side by construction; they remain on the folder side until it is slimmed.
- The server grows by the checks an assistant needs; guidance size is controlled by topics, not by trimming content.
- Every new check is written once, in shared code, and must be reachable from the command line.
- A client that can run a command can use the server without a vendor package; clients that can only take a hosted or HTTP server are not served by this decision.
