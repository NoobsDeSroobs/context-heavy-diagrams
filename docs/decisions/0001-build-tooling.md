# 0001: Build tooling for the Electron + React + TS shell

## Status
Accepted

## Context
Needed a way to scaffold and build an Electron app with a React + TypeScript renderer, with a proper main/preload/renderer split. Three options considered: `electron-vite`, `electron-forge`, or wiring Vite + Electron + electron-builder by hand. This decision presupposes Electron + React + TypeScript as the stack — that choice (and React Flow as the canvas engine) is itself recorded separately in [ADR 0016](0016-shell-and-canvas-stack.md), numbered later only because it was written up retroactively.

## Decision
Use **electron-vite**. It's purpose-built for the main/preload/renderer split, gives a fast dev loop (HMR) with good TypeScript defaults out of the box, and gets us to writing actual application code (the interesting learning here — Electron's process model, IPC design, React Flow) faster than hand-wiring three build configs or working through `electron-forge`'s newer/less-proven Vite template.

## Alternatives considered
- **electron-forge**: official Electron tooling, built-in packaging/installers ("makers"). Rejected for now — its Vite template is newer and less battle-tested than its webpack template, and packaging/distribution is explicitly deferred (see project brief non-goals), so its main advantage isn't needed yet.
- **Fully manual** (Electron + Vite + electron-builder wired by hand): maximum learning value, since every config wire is visible. Rejected for the *initial* scaffold because the interesting learning is Electron's process model and React Flow, not Vite config syntax — but this remains a legitimate option to revisit if electron-vite's abstractions ever get in the way.

## Consequences
- Fast start, less config yak-shaving up front.
- If electron-vite goes stale or we outgrow it, switching to electron-forge is a *moderate* port, not a rewrite: only build config (`electron.vite.config.ts` → forge's vite configs) and `package.json` scripts change. Electron's core APIs (main/preload/renderer, IPC, `BrowserWindow`) are identical either way, so application code (React components, IPC handlers, diagram logic) is unaffected and doesn't move.
- That "moderate cost" assumption holds only as long as we don't build custom packaging/auto-update/code-signing flows on top of electron-vite + electron-builder — those would be tool-specific and would need real rework on a later switch. Not a near-term concern since packaging is out of scope for now (see project brief non-goals).
- We'll still need `electron-builder` (or equivalent) later for packaging/installers, regardless of this choice.
