# 0169: No live connection between the MCP server and the running app

## Status
Accepted (2026-11-10). Settles the open item in [ADR 0138](0138-the-mcp-server-carries-the-guidance-the-cli-carries-the-checks.md); the offline rule of [ADR 0113](0113-enforced-offline-behaviour.md) is unchanged.

## Context
The MCP server (`chd mcp`, [ADR 0110](0110-claude-desktop-extension.md)) is a separate process the assistant's client starts, so it sees files and nothing else: not the open diagram, the selection or unsaved edits. A connection from the server to the running app could tell it. The app would have to open a listener, which is a network API even on one machine and trips the tripwire of ADR 0113.

Measured on Windows: a Node named pipe gets an access list that gives **Everyone and the anonymous logon read access**, and Node cannot narrow it. A Unix socket is protected only by the permissions of its file and folder. A loopback TCP port is reachable by any local program and by web pages. Whatever the transport, a secret on the first message is the only real protection, and a tunnel or port forward the person sets up removes the locality.

## Decision
1. **The app opens no listener.** No port, socket or pipe, for any program. The server stays a separate process that reads and writes files, and the stale-edit check of [ADR 0109](0109-stale-edit-check-for-every-ai-write-path.md) stays the only guard between an assistant's write and the person's work.
2. **The offline tripwire stays as it is.** No Node networking module is allowed anywhere in `src/`, `extension/` or the command line.
3. **What the person points at reaches an assistant through the clipboard,** by an explicit act, not through a standing connection. The existing copy ([ADR 0049](0049-clipboard-copy-paste.md)) puts the selection there as JSON and is enough; a leaner form for assistants (the `.chd` node shape, without notes and links) is not built.

## Why
- **The gain is small.** The unsaved-edit gap is covered from the person's side: a single notice names every file changed outside the app, and says which have unsaved edits ([ADR 0159](0159-one-notice-for-every-file-that-changed-outside-the-app.md)). What is left is the selection.
- **The larger payoff is spectacle, not function.** An assistant editing in the open window, with the person watching, is the one thing that would justify the cost, and the maintainer does not want it. The assistant's result stays a file the person reviews afterwards.
- **The cost stays.** A standing attack surface, a changed offline rule, a token to hand over, a warning on every switch-on and an indicator nobody may forget.
- **Others do take the risk.** EffectCraft, which an assistant can drive live, opens an unauthenticated JSON channel on `127.0.0.1` when started with a port (`--control`) and advises enabling it only while it is used. That fits an editor whose whole state is in memory; here the state is files.

## Alternatives considered
- **Loopback TCP port.** Reachable from web pages and any local program; needs Origin and Host checks as well as a token.
- **Local socket or named pipe.** The front-runner, but on Windows other users can read the pipe, so it still rests on a token, and it needs the tripwire to change.
- **A spool folder the app watches.** No listener, but slow, with no reply, and a writable folder is a channel too.
- **Hand-off through the running instance** (`second-instance`). One-way, so it can open a file but not answer a question.
- **The server reading the crash-recovery snapshots.** Holds unsaved text, but only periodically and in the app's private folder.

## Not ruled out
An assistant that drives the window the way a person does, with the screen, the mouse and the keyboard, needs nothing from the app: no listener, no token. That is the assistant's tool, not a connection this app offers, and nothing here prevents it.

## If it is revisited
For a protocol into the app (live editing, say). Then: the tripwire gets a narrow named exception for one local socket in the user's runtime folder; a token per start, never written into a diagram folder; off by default, a visible indicator and an idle timeout; a warning on every switch-on that any program holding the token can read the open diagram; no save operation on the connection, so only the person saves; an edit is rejected if the diagram changed since the assistant read it (the in-memory form of ADR 0109) and arrives as one undo step. Not verified: whether a Windows pipe can be reached from another machine, and Unix socket permissions on Linux and macOS.
