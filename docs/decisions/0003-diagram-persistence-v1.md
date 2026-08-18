# 0003: Diagram persistence — v1 schema and IPC contract

## Status
Accepted, amended — see the `saveDiagramAs` correction at the bottom of Consequences. The `window.prompt()` part of the original decision didn't survive contact with testing.

## Context
Epic [0001](../planning/epics/0001-bare-electron-react-shell.md) needs save/load of a single `diagram.json` through Electron's main process (renderer has no direct filesystem access — see the process-model section of [docs/architecture/overview.md](../architecture/overview.md)). The full node schema in [docs/project-brief.md](../project-brief.md) includes fields (style, rotation, icons, details, linkedDiagram) that belong to later epics. Need a v1 subset that won't require a breaking rewrite when those land.

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
Fields from the brief's full schema (`size`, `rotation`, `style`, `data.icons`, `data.details`, `data.linkedDiagram`) are intentionally absent — they arrive with their respective epics (0002 resize/rotate, 0003 styling, 0007 icons, 0008 details, 0009 linked diagrams) as additive fields, not a schema rewrite.

**Serialization**: explicit mapping functions (`toDiagramFile` / `fromDiagramFile` in `src/shared/diagram.ts`) convert between React Flow's `Node[]`/`Edge[]`/`Viewport` and this schema — never persist React Flow's objects directly. React Flow's `Node` carries transient UI state (`selected`, `dragging`, `measured`) that would create diff noise on every save even with no real change. Building the output object with a fixed key order on every call, then `JSON.stringify(obj, null, 2)`, satisfies the brief's determinism requirement without needing a canonical-JSON library.

**IPC contract** (`window.api`, defined in `src/preload/index.ts` / `src/main/diagram.ts`, using `ipcMain.handle`/`ipcRenderer.invoke` since these need return values):
- `openDiagram(): Promise<{ path: string; diagram: DiagramFile } | null>` — native open-file dialog filtered to `.json`, reads and validates. `null` on cancel.
- `saveDiagramAs(diagram: DiagramFile): Promise<string | null>` — ~~open-directory dialog to pick a *parent* folder, then `window.prompt()` in the renderer for the new diagram's folder name, creates `<parent>/<name>/diagram.json`~~ **corrected**: `window.prompt()` doesn't exist in Electron (see Consequences) — instead, an open-directory dialog (with "create new folder" enabled) picks or creates the diagram folder directly, and `diagram.json` is written straight into it. Returns the written path, or `null` on cancel.
- `saveDiagram(path: string, diagram: DiagramFile): Promise<void>` — writes to an already-known path, no dialog.

## Alternatives considered
- **Directory-picker-only "Save As"** (`openDirectory` + `createDirectory`, no prompt): fewer moving parts, but forces the user through the OS folder browser's "New Folder" button to name a diagram rather than just typing a name — a clunkier mental model than a normal "Save As". Rejected for UX, even though it's a few lines simpler.
- **Persisting React Flow's `toObject()` output directly**: React Flow ships this exact method for save/restore flows, and it was tempting to lean on it directly. Rejected because its output includes transient UI fields, which conflicts directly with the brief's "deterministic serialization, no spurious diffs" requirement.
- **A full custom "New Diagram" modal instead of `window.prompt()`**: better UX, matches the eventual product polish level. Deferred — `window.prompt()` is ugly but functional, and building a proper modal now is premature given the properties panel (epic 0003) will introduce real in-app dialog/panel patterns to reuse. Worth revisiting once that exists.

## Consequences
- Adding fields to `DiagramNode`/`DiagramEdge` in later epics is additive (optional fields), not a migration — old files stay loadable.
- `openDiagram` currently trusts any selected `.json` file loosely matching the shape; no schema versioning/migration logic exists yet beyond the `version: 1` tag. Fine for a single-developer v1; revisit before this is used by anyone else.

**Correction found during manual testing of epic 0001**: `window.prompt()` throws `Error: prompt() is not supported` in Electron's renderer — Electron's Chromium build implements `alert()`/`confirm()` but deliberately not `prompt()`. The "prompt for a name, then pick a parent folder" flow described above never worked. Replaced with: a single open-directory dialog (`properties: ['openDirectory', 'createDirectory']`) where the OS-native "New folder" control does the naming, and `diagram.json` is written directly into whatever folder gets picked/created — no parent/name split, no `diagram:writeNew` two-step. Simpler than the original design, not just a workaround. The "defer a proper in-app naming modal to epic 0003" reasoning still stands; it's just moot for now since this path needs no naming UI at all.
