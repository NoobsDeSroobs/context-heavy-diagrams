# Security policy

## Reporting a vulnerability

Please **do not open a public issue** for a security problem. Use GitHub's private reporting instead: on the repository page choose **Security → Report a vulnerability**
([direct link](https://github.com/NoobsDeSroobs/context-heavy-diagrams/security/advisories/new)). Include what you found, how to reproduce it (a small `.chd` file is ideal) and what you think the impact is.

This is a one-person hobby-scale project, so there is no service-level promise, but reports are read and taken seriously. The aim is to acknowledge a report within about a week. Once a fix exists you are welcome to be credited, or to stay anonymous.

## Supported versions

The project is at an early 0.x stage. Only the latest commit on `master` is supported; fixes are not backported. There are no published installers yet, so most users run from source.

## What is in scope

Context Heavy Diagrams is an offline desktop app. Its design promises are the places to look:

- **It makes no network connections.** Every non-local request from the app's windows is blocked and a test fails if a network API appears in the source ([ADR 0113](docs/decisions/0113-enforced-offline-behaviour.md)). Anything that makes it talk to the network, or lets content reach a remote host, is in scope.
- **A `.chd` file is untrusted input.** People will open diagrams shared by others. A file must not be able to read, write, copy or delete anything outside its own folder, run code, or take over the app window ([ADR 0115](docs/decisions/0115-paths-stored-in-diagrams-are-untrusted.md)).
- **The renderer is sandboxed** and has only a narrow, purpose-built bridge to the main process; navigation away from the app and all permission requests are refused ([ADR 0112](docs/decisions/0112-electron-hardening-sandbox-and-navigation.md)). A way around that is in scope.
- **Notes and linked content** (Markdown details, SVG/PNG icons and reference images, linked diagrams) are rendered from files on disk and must not execute script or load remote content.
- **The AI integration** (the `chd` command-line tool, the bundled skill and the Claude Desktop extension) is built so that writes refuse to overwrite a file that changed since it was read ([ADR 0109](docs/decisions/0109-stale-edit-check-for-every-ai-write-path.md)) and stay inside the chosen folder. Escaping either is in scope.

## What is out of scope

- Problems that need an attacker who can already run code as the user or edit the app's own files.
- Content an AI assistant receives when you choose to point one at your diagrams. That is sent to the assistant's provider by design, and the app says so.
- Advisories that affect only build and development tooling and never ship in the app. These are tracked in the planning docs rather than treated as vulnerabilities, and CI audits what does ship (`npm audit --omit=dev`).
- Windows SmartScreen or similar warnings about unsigned builds. Code signing is a known, deferred item.

## Platform note

The security review was done and verified on Windows. The Linux and macOS behaviour follows the same code but has not been independently verified.
