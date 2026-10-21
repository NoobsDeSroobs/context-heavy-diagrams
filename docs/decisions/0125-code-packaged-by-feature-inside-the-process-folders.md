# 0125: Code is packaged by feature inside the process folders

## Status
Accepted.

## Context
A feature's code was scattered. The legend, for example, lived in `components/`, as loose top-level files, in `export/`, and as a type in `shared/diagram.ts`; references had files in four folders plus `main/`. The renderer was grouped partly by kind (`components/`, `panels/`, `hooks/`) and partly by topic, and `shared/diagram.ts` held every feature's file-format types in one 785-line file. A reader could not tell why `main/` and `renderer/` both have style files.

## Decision
- **The electron-vite layout stays:** `src/main`, `src/preload`, `src/renderer/src` and `src/shared`, with their names. They are three runtimes with separate builds and a sandbox boundary ([ADR 0112](0112-electron-hardening-sandbox-and-navigation.md)), and sticking to the template's norm helps anyone who knows it.
- **Inside each, code is grouped by feature.** A feature uses the same folder name in every tree where it has code, so `styling/` in `main/`, `renderer/src/` and `shared/` is one concept in three layers: `shared` is pure data and rules (no Node, no DOM, also used by the CLI and the extension), `renderer` applies it on screen, `main` does the disk and dialogs.
- **File-format types live with their feature**, in `shared/<feature>/schema.ts`. `shared/diagram/` composes them into `DiagramFile` and holds parsing and serialising. A union sits next to the interface that uses it; there is no shared enums file. `docs/file-format.md` must be updated whenever a `schema.ts` changes.
- **App-frame files stay at the tree root** (`main/index.ts`, `windows.ts`, `App.tsx`, `MenuBar.tsx`). Generic widgets (dialogs, pickers, editable label) go in `renderer/src/ui/`.
- **Import boundaries are lint rules:** `shared` imports neither `main` nor `renderer`, and `renderer` never imports `main`.
- **Moves are mechanical** (`git mv`, no behaviour change). Splitting large files and renaming types are separate work.

## Alternatives considered
- **Feature-first at the top, each feature holding its own `main/`, `renderer/`, `shared/`.** Best locality, but it leaves the template layout and merges the Node and DOM type checking that the two tsconfigs keep apart.
- **Leave the folders, split only `Canvas.tsx`.** Does not fix the scattering.
- **Flatten `renderer/src`, or rename `main`, `renderer` and `shared` to descriptive names.** Config churn and a departure from what contributors expect, with no benefit worth that.
- **One shared `Enums.ts`.** Groups by kind, the habit this decision moves away from.

## Consequences
- A feature spans up to three folders with the same name, found by name rather than by process.
- ADRs and other history cite the old paths and are not rewritten; the current docs name the new ones.
- Cross-feature imports are unrestricted for now; an index-file rule can be added once the layout has settled.
