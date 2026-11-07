# 0163: The MCP server connected to the running app, with a toggle

## Status
Not Started. Depends on the `chd mcp` command from [ADR 0138](../../decisions/0138-the-mcp-server-carries-the-guidance-the-cli-carries-the-checks.md); do not start before it exists.

## Goal
An assistant using `chd mcp` can ask the running app what is open, what is selected and what has unsaved changes, and a person turns that connection on and off from the menu and can always see its state. Edits still arrive as file writes the person reviews afterwards: the app's window does not update live unless a later, separate mode is turned on.

## Why
The server is a separate process the client starts, so it sees only files on disk. It cannot know the open diagram, the selection or an unsaved edit, which also leaves a gap in the stale-edit check ([ADR 0109](../../decisions/0109-stale-edit-check-for-every-ai-write-path.md)) for work the person has not saved.

## The offline rule
A listener is a network API even when nothing leaves the machine. The tripwire in [ADR 0113](../../decisions/0113-enforced-offline-behaviour.md) fails on any Node networking module, so this epic changes that rule on purpose: an ADR amends 0113 and the test, and states exactly what is allowed (a connection that never leaves the machine, opened only on request) and what stays banned (any outbound request). The README's offline wording is checked against the result.

## Transport options
| Option | Reachable by | Offline tripwire | Notes |
|---|---|---|---|
| Loopback TCP port | Any local process, and web pages through the browser | Fires | Needs authentication and Origin and Host checks |
| Local socket (Unix socket, Windows named pipe) | Local processes of the same user; no web page | Fires (`net`) | Front-runner. Windows pipe permissions to verify |
| Spool folder the app watches | Whoever can write the folder | Does not fire | Slow and clumsy; no request and reply |
| Single-instance hand-off | The command line | Does not fire | One-way, so open-a-diagram only |

## Behaviour
- **Off by default**, switched from the menu, closed when the app exits. The menu entry shows the state (on or off) and a visible indicator stays up while it is on. A connection that can read the open diagram must be impossible to forget about.
- **Authenticated:** a token made per start, handed to `chd mcp` through the user's settings or an environment variable, never written into a diagram folder.
- **Read-only first:** open file, selection, unsaved flag. Writes still go through the server's file write with the stale-edit check.
- **Folder scope and write limits** of [ADR 0110](../../decisions/0110-claude-desktop-extension.md) carry over unchanged.
- **Editing in the open window is a later mode,** opt-in, for people who do not want the review step in that session. It is not part of this epic. When it is designed: the connection has no save operation at all, so only the person saves; the edit is validated like a file write, arrives as one undoable step, and shows up as changes, not silently. The assistant's edit is rejected if the person changed the diagram since the assistant read it (the in-memory form of [ADR 0109](../../decisions/0109-stale-edit-check-for-every-ai-write-path.md)), so the person is told before their work is overwritten. The reverse is not required: a person who edits while an assistant works is responsible for what that does to its work, and the review window shows it. A notice that an assistant is working could be added later. A separate feature, if wanted later: the assistant's proposal as an unsaved copy you can apply or drop, like a stash, compared with the original in the review window. The periodic autosave writes only to the recovery folder, so check that a crash does not offer an assistant's unsaved edits back as if they were the person's.
- **What that mode runs** is the operations of [0165](../completed-epics.md#0165-an-editing-tool-for-assistants), executed by the app on its live diagram; that epic is designed to leave room for it.

## Risk and the warning
Local-only does not stop software already running as the user, and a local connection can be bridged outward: by a web page if the transport is a TCP port (a local socket or pipe cannot be reached from a browser), by a tunnel or port forward the user sets up, or by any process that can read the token. So:
- Bind to loopback only, with no setting to change that; read-only; the token per start and never stored in a diagram folder; an idle timeout switches the connection off; the indicator shows the last connection.
- **A warning each time it is switched on**, in plain words: while it is on, any program running as you that holds the token can read the open diagram, including unsaved changes; local-only does not protect against software already on the machine; do not forward or tunnel it unless you know what you are doing (there are valid cases, such as a container or a remote machine, but then the token is the only protection); what an assistant reads goes to its provider; switch it off when not in use. The same text goes in the documentation.
- The gain is modest (open diagram, selection, unsaved state) against a standing attack surface, so the spike ends in a go or no-go. Not building it is an acceptable outcome.

## Tasks
- [ ] Spike: pick the transport (front-runner: local socket), check permissions on Windows and Linux, and decide go or no-go
- [ ] ADR: the connection, and the amendment to 0113 and the tripwire test
- [ ] Read the reference design of the app that inspired this (its control-protocol doc) for the handshake and token handling
- [ ] The listener in the main process, off by default, with the token
- [ ] `chd mcp` uses it when told to and falls back to files when the app is not running
- [ ] Menu toggle with the state shown, the always-visible indicator, the idle timeout and the warning on every enable
- [ ] Decide how an unsaved edit and an on-disk write from an assistant interact
- [ ] README, getting-started and the AI documentation say exactly what is opened
- [ ] Test on Linux, where socket permissions behave differently

## Notes
Raised while discussing whether the MCP server should be reversed so any assistant can attach to the app. The launch command came first; this is the part that needs a security design.
