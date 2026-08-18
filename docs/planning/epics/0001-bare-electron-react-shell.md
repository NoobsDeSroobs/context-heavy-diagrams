# 0001: Bare Electron + React shell

## Status
In Progress

## Goal
A running Electron app with a React + TypeScript renderer, an embedded React Flow canvas (pan/zoom, basic node/edge creation and dragging), and save/load of a single `diagram.json` to/from disk via IPC.

## Tasks
- [ ] `git init` this repo, initial commit of the docs scaffold
- [ ] Scaffold electron-vite (react-ts template) into the repo root
- [ ] `npm install`, verify the app boots to a blank window
- [ ] Embed React Flow, render an empty pannable/zoomable canvas
- [ ] Basic node/edge creation and dragging (React Flow defaults, no custom node types yet)
- [ ] Define preload IPC bridge + main-process handlers for "save diagram" / "open diagram" (native file dialogs)
- [ ] Wire save: serialize `{nodes, edges, viewport}` to `diagram.json` deterministically
- [ ] Wire load: read `diagram.json`, hydrate the canvas
- [ ] Manual smoke test: create a few nodes/edges, save, quit, relaunch, load, verify round-trip
