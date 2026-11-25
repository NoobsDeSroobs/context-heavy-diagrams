// Test support for the edit operations. The tool makes every id, and an operation names what it
// makes with a handle ("as": "$api") that only the rest of the same call can use (ADR 0199). Tests
// want to read their diagrams, so `applyNamed` does what a person reading the answer would do:
//   - a plain reference ("api") to something made earlier in the same call is written as its handle
//     ("$api"), which is how the tool is used, and
//   - once the call is done, each element it made with a handle is given the handle's name as its id,
//     so the next call, and every assertion, can say "api".
// Nothing here is in the tool: the tool never takes an id and never keeps a handle.

const REFERENCE_KEYS = ['id', 'from', 'to', 'parent']

function deepRename(value, names) {
  if (typeof value === 'string') return names.has(value) ? names.get(value) : value
  if (Array.isArray(value)) return value.map((item) => deepRename(item, names))
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, deepRename(item, names)])
    )
  }
  return value
}

export function applyNamed(apply, diagram, operations, options) {
  const made = new Set(
    operations.filter((op) => typeof op?.as === 'string').map((op) => op.as.slice(1))
  )
  const existing = new Set([
    ...diagram.nodes.map((n) => n.id),
    ...diagram.edges.map((e) => e.id),
    ...(diagram.legend ?? []).map((l) => l.id)
  ])
  const handle = (value) =>
    typeof value === 'string' && made.has(value) && !existing.has(value) ? `$${value}` : value
  const written = operations.map((op) => {
    if (op === null || typeof op !== 'object') return op
    const out = { ...op }
    for (const key of REFERENCE_KEYS) if (typeof out[key] === 'string') out[key] = handle(out[key])
    if (Array.isArray(out.ids)) out.ids = out.ids.map(handle)
    return out
  })
  const done = apply(diagram, written, options)
  const names = new Map()
  for (const result of done.results) {
    const id = result.element?.id ?? result.legendEntry?.id
    if (result.as !== undefined && id !== undefined) names.set(id, result.as.slice(1))
  }
  return {
    ...done,
    diagram: deepRename(done.diagram, names),
    results: done.results.map((result) => deepRename(result, names))
  }
}
