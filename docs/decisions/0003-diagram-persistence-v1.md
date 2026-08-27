# 0003: Diagram persistence — v1 schema and IPC contract

## Status
Accepted, amended three times — see Consequences. This whole model (diagram = mandatory folder, fixed `diagram.json` name) is itself superseded by [ADR 0005](0005-diagram-identity-and-linking.md) and was later replaced by the single-file `.chd` format. Kept here as the historical record of what the early folder-based versions actually shipped and iterated on in the meantime.

## Context
The first working shell needs save/load of a single `diagram.json` through Electron's main process (renderer has no direct filesystem access — see the process-model section of [docs/architecture/overview.md](../architecture/overview.md)). The full node schema in [docs/project-brief.md](../project-brief.md) includes fields (style, rotation, icons, details, linkedDiagram) that belong to later work. Need a v1 subset that won't require a breaking rewrite when those land.

## Decision

**Schema (`src/shared/diagram.ts`), v1 subset:**
```ts
interface DiagramFile {
  version: 1
  viewport: { x: number; y: number; zoom: number }
  nodes: DiagramNode[]
  edges: DiagramEdge[]
}
interface DiagramNode {
  id: string
  type?: string
  position: { x: number; y: number }
  data: { label: string }
}
interface DiagramEdge {
  id: string
  source: string
  target: string
}
```
Fields from the brief's full schema (`size`, `rotation`, `style`, `data.icons`, `data.details`, `data.linkedDiagram`) are intentionally absent — they arrive later (resize/rotate, styling, icons, details, linked diagrams) as additive fields, not a schema rewrite.

**Serialization**: explicit mapping functions (`toDiagramFile` / `fromDiagramFile` in `src/shared/diagram.ts`) convert between React Flow's `Node[]`/`Edge[]`/`Viewport` and this schema — never persist React Flow's objects directly. React Flow's `Node` carries transient UI state (`selected`, `dragging`, `measured`) that would create diff noise on every save even with no real change. Building the output object with a fixed key order on every call, then `JSON.stringify(obj, null, 2)`, satisfies the brief's determinism requirement without needing a canonical-JSON library.

**IPC contract** (`window.api`, defined in `src/preload/index.ts` / `src/main/diagram.ts`, using `ipcMain.handle`/`ipcRenderer.invoke` since these need return values):
- `openDiagram(): Promise<{ path: string; diagram: DiagramFile } | null>` — native open-file dialog filtered to `.json`, reads and validates. `null` on cancel.
- `saveDiagramAs(diagram: DiagramFile): Promise<string | null>` — ~~open-directory dialog to pick a *parent* folder, then `window.prompt()` in the renderer for the new diagram's folder name~~ ~~open-directory dialog (with "create new folder" enabled) picks or creates the diagram folder directly~~ **corrected again**: a native `showSaveDialog` (see Consequences) lets the user actually type the diagram's name — that name becomes the folder, `diagram.json` is written inside it. Returns the written path, or `null` on cancel.
- `saveDiagram(path: string, diagram: DiagramFile): Promise<void>` — writes to an already-known path, no dialog.

## Alternatives considered
- **Directory-picker-only "Save As"** (`openDirectory` + `createDirectory`, no prompt): fewer moving parts, but forces the user through the OS folder browser's "New Folder" button to name a diagram rather than just typing a name — a clunkier mental model than a normal "Save As". Rejected for UX, even though it's a few lines simpler.
- **Persisting React Flow's `toObject()` output directly**: React Flow ships this exact method for save/restore flows, and it was tempting to lean on it directly. Rejected because its output includes transient UI fields, which conflicts directly with the brief's "deterministic serialization, no spurious diffs" requirement.
- **A full custom "New Diagram" modal instead of `window.prompt()`**: better UX, matches the eventual product polish level. Deferred — `window.prompt()` is ugly but functional, and building a proper modal now is premature given the properties panel will introduce real in-app dialog/panel patterns to reuse. Worth revisiting once that exists.

## Consequences
- Adding fields to `DiagramNode`/`DiagramEdge` in later epics is additive (optional fields), not a migration — old files stay loadable.
- `openDiagram` currently trusts any selected `.json` file loosely matching the shape; no schema versioning/migration logic exists yet beyond the `version: 1` tag. Fine for a single-developer v1; revisit before this is used by anyone else.

**Correction #1, found during manual testing of the first shell**: `window.prompt()` throws `Error: prompt() is not supported` in Electron's renderer — Electron's Chromium build implements `alert()`/`confirm()` but deliberately not `prompt()`. The "prompt for a name, then pick a parent folder" flow described above never worked. Replaced with: a single open-directory dialog (`properties: ['openDirectory', 'createDirectory']`) where the OS-native "New folder" control does the naming, and `diagram.json` is written directly into whatever folder gets picked/created — no parent/name split, no `diagram:writeNew` two-step. Simpler than the original design, not just a workaround. The "defer a proper in-app naming modal to the properties-panel work" reasoning still stands; it's just moot for now since this path needs no naming UI at all.

**Correction #2, found during manual use once the folder-based model had been through a couple of iterations**: the directory-picker replacement above technically worked but was bad UX in practice — it lets you pick or create a folder, but there's no "type a name" moment at all, so naming a new diagram meant fighting the OS folder browser's inline "New folder" control every time. Replaced with `dialog.showSaveDialog()` (`diagram:pickSaveFolder` channel), which is the standard native "type a name, browse to a location" dialog. What the user types is treated as the diagram's name and becomes the folder (mirroring how macOS bundle formats like `.pages`/`.key` present a folder as a single named "file"); `diagram:saveNew` then `mkdir`s that path and writes `diagram.json` inside it. Also added `try`/`catch` with a user-visible `alert()` around save/open in `Canvas.tsx` — a save failure was previously a silent unhandled rejection, which is a bad failure mode for something as consequential as saving.

**Correction #3, found during manual testing**: because `showSaveDialog` visually looks like a normal "name a file" dialog, a user reasonably typed a trailing `.json` expecting to name a file — but that input was being used as a folder name, producing a folder literally named `something.json` with `diagram.json` nested inside it. Patched by stripping a typed `.json` extension before using the input as a folder name. This is a band-aid on a model that's already been decided to go away entirely (see [ADR 0005](0005-diagram-identity-and-linking.md)) — the real fix is the single-file format, where there's no folder-vs-file naming mismatch to strip around in the first place.
