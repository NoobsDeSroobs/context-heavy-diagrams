# 0159: An AI menu that serves more than Claude

## Status
Not Started.

## Goal
The three ways to give an AI assistant access to a diagram stay as they are, but the menu and the wording stop reading as Claude-only, and the MCP server can be set up in apps other than Claude Desktop.

## Where it stands
| Route | What it does | Claude-specific? |
|---|---|---|
| Copy AI instructions | Puts the prompt on the clipboard | No, any LLM |
| Enable AI assistance in a folder | Writes `AGENTS.md`, `CLAUDE.md` and `.claude/skills/chd-diagrams/` | Partly: `AGENTS.md` is read by other agents, the other two are Claude Code's |
| Install Claude Desktop extension | Opens the bundled `.mcpb` | The server is plain MCP over stdio; only the `.mcpb` package is Claude Desktop's |

## Proposed menu
```
AI
  Copy AI instructions
  Enable AI assistance in a folder…
  Install the MCP server for  ▸
      Claude Desktop…
      Other apps: copy server settings…
```
Named entries for further apps are added one at a time, once each has been tested; their config formats change and cannot be assumed.

## What "copy server settings" needs
- The server shipped unpacked beside the `chd` command line (today it exists only inside the zipped `.mcpb`).
- A way to run it without a system Node: the launcher that runs the app's own executable as Node, as the `chd` command line does ([ADR 0106](../../decisions/0106-chd-command-line-tool.md)).
- A snippet with the launcher path, the server file, the chosen folder and the update setting (read-only by default). The AI-provider data warning stays.
- Not limited to Windows and macOS, which gives Linux a route to the server for the first time.

## Tasks
- [ ] Restructure the AI menu as above; the label and dialog text say "MCP server", not "extension", except for the Claude Desktop entry
- [ ] Ship the server unpacked and add the launcher
- [ ] "Other apps: copy server settings…": folder picker, update choice, snippet, warning
- [ ] Reword the folder-setup label and docs so they say which parts serve any agent (`AGENTS.md`) and which serve Claude Code
- [ ] Update ADR 0110 ("Getting it to the user") and ADR 0105 in place; no new ADR, the delivery routes are the same
- [ ] Update the docs and the README where they describe the extension as the only MCP route
- [ ] Test on Linux, where the menu entry is new

## Notes
Raised while preparing the showcase video, where the menu is described as "Claude for now".
