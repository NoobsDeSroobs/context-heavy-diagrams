import { labelToFileStem } from './labelFileName'

// Where a detail note belongs, derived from its element's label + id — the one
// definition, used by the save planner (ADR 0092: derived at save, never
// stored). Same convention as ADR 0060/0074: `<label stem>-<uuid>.md` inside
// the diagram's sibling `<diagram name>/details/` folder. Returned relative to
// the diagram file's directory, '/'-separated, so it can be stored as-is in
// `data.details`.

// The diagram file's name without directory or extension (Windows or POSIX
// separators — a diagram path is whatever the OS handed us).
export function diagramBaseName(diagramPath: string): string {
  const name = diagramPath.split(/[\\/]/).pop() ?? diagramPath
  const dot = name.lastIndexOf('.')
  return dot > 0 ? name.slice(0, dot) : name
}

export function derivedDetailsPath(diagramPath: string, nodeId: string, label: string): string {
  // A plain UUID has no hyphen before its first segment, so slicing off
  // everything up to the id's first hyphen isolates it regardless of prefix.
  const uuid = nodeId.slice(nodeId.indexOf('-') + 1)
  return `${diagramBaseName(diagramPath)}/details/${labelToFileStem(label, 'untitled')}-${uuid}.md`
}
