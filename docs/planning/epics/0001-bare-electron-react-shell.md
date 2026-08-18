# 0001: Bare Electron + React shell

## Status
Done

## Goal
A running Electron app with a React + TypeScript renderer, an embedded React Flow canvas (pan/zoom, basic node/edge creation and dragging), and save/load of a single `diagram.json` to/from disk via IPC.

## Tasks
- [x] `git init` this repo, initial commit of the docs scaffold
- [x] Scaffold electron-vite (react-ts template) — done into `temp_dump/electron-scaffold` (Windows Node conflicts forced scaffolding outside the repo root; see Notes). Still needs relocating into the repo root proper.
- [x] `npm install`, verify the app boots to a blank window — confirmed via `npm run dev`, Electron window opened with the default template screen
- [x] Move the scaffolded files from `temp_dump/electron-scaffold` into the repo root, merging with existing `CLAUDE.md`/`PROGRESS.md`/`docs/` — committed on `epic/0001-bare-shell`
- [x] Embed React Flow, render an empty pannable/zoomable canvas
- [x] Basic node/edge creation and dragging (React Flow defaults, no custom node types yet) — via toolbar "Add node" button + drag-to-connect handles
- [x] Define preload IPC bridge + main-process handlers for "save diagram" / "open diagram" (native file dialogs)
- [x] Wire save: serialize `{nodes, edges, viewport}` to `diagram.json` deterministically
- [x] Wire load: read `diagram.json`, hydrate the canvas
- [x] Manual smoke test: create a few nodes/edges, save, quit, relaunch, load, verify round-trip — confirmed working

## Notes

Windows-native Node was 22.9.0, one point release below the 22.12.0 cutoff where `require(esm)` became unflagged — broke `electron-builder`'s postinstall (`ERR_REQUIRE_ESM` loading `@noble/hashes`) and several other packages in this toolchain that now require `>=22.12.0`. Fixed by upgrading Node to v24.19.0. Scaffolding itself also couldn't run non-interactively against the repo root (create-electron prompts, and answering "yes" to its non-empty-directory prompt wipes the target dir — would have destroyed `.git`/`CLAUDE.md`/`docs/`), so it was scaffolded into `temp_dump/electron-scaffold` instead, interactively, by the user directly in a terminal.

Manual testing after the first working build surfaced: no arrowheads on edges (fixed — added a default `markerEnd`, full arrowhead/line styling is still epic 0003), `Controls`/`MiniMap` rendering in React Flow's light theme against our dark app (fixed with a hardcoded `colorMode="dark"`, real light/dark toggle is epic 0005), only two fixed connection points per node (expected — tracked as a task on epic 0002), and a real bug: `Save As…` did nothing because it called `window.prompt()`, which Electron doesn't implement (throws `prompt() is not supported`). Fixed by dropping the naming prompt entirely — the OS folder picker's own "New folder" button handles naming instead. See [docs/decisions/0003-diagram-persistence-v1.md](../../decisions/0003-diagram-persistence-v1.md) for the full correction.
