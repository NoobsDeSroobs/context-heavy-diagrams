// Scores a repaired diagram against its start (epic 0168's trial): the layout problems left by kind, whether
// the elements, edges and labels are all still there, and how much was moved or rerouted.
// Usage: node score.mjs <start.chd> <repaired.chd>
import { readFileSync } from 'node:fs'
import { parseDiagram } from '../../src/shared/diagram/index.ts'
import { layoutIssues } from '../../src/shared/edit/inspect.ts'

const [startFile, endFile] = process.argv.slice(2)
if (!startFile || !endFile) {
  console.error('usage: node score.mjs <start.chd> <repaired.chd>')
  process.exit(2)
}
const load = (file) => parseDiagram(readFileSync(file, 'utf-8'))
const start = load(startFile)
const end = load(endFile)

const count = (diagram) => {
  const kinds = {}
  for (const issue of layoutIssues(diagram, diagram.fontFamily)) {
    kinds[issue.kind] = (kinds[issue.kind] ?? 0) + 1
  }
  return kinds
}
const before = count(start)
const after = count(end)
const kinds = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort()
console.log('problems (start -> repaired):')
for (const kind of kinds) console.log(`  ${kind}: ${before[kind] ?? 0} -> ${after[kind] ?? 0}`)
const total = (kindCounts) => Object.values(kindCounts).reduce((a, b) => a + b, 0)
console.log(`  total: ${total(before)} -> ${total(after)}`)

// What must not change.
const joined = (e) => `${e.source}>${e.target}`
const nodeIds = (d) =>
  d.nodes
    .map((n) => n.id)
    .sort()
    .join()
const edgeKeys = (d) =>
  d.edges
    .map((e) => `${e.id}:${joined(e)}:${e.data?.label ?? ''}`)
    .sort()
    .join()
const nodeLabels = (d) =>
  d.nodes
    .map((n) => `${n.id}:${n.data?.label ?? ''}`)
    .sort()
    .join()
console.log('kept as it was:')
console.log(`  same elements: ${nodeIds(start) === nodeIds(end)}`)
console.log(`  same edges, ends and labels: ${edgeKeys(start) === edgeKeys(end)}`)
console.log(`  same element labels: ${nodeLabels(start) === nodeLabels(end)}`)

// What was done.
const at = new Map(start.nodes.map((n) => [n.id, n]))
const moved = end.nodes.filter((n) => {
  const was = at.get(n.id)
  return was && (was.position.x !== n.position.x || was.position.y !== n.position.y)
}).length
const resized = end.nodes.filter((n) => {
  const was = at.get(n.id)
  return was && (was.size?.width !== n.size?.width || was.size?.height !== n.size?.height)
}).length
const withPoints = (d) => d.edges.filter((e) => (e.points ?? []).length > 0).length
const routings = {}
for (const e of end.edges) {
  const r = e.style?.routingStyle ?? 'default'
  routings[r] = (routings[r] ?? 0) + 1
}
const handleChanges = end.edges.filter((e) => {
  const was = start.edges.find((s) => s.id === e.id)
  return was && (was.sourceHandle !== e.sourceHandle || was.targetHandle !== e.targetHandle)
}).length
console.log('done:')
console.log(`  elements moved: ${moved}, resized: ${resized}`)
console.log(`  edges with bend points: ${withPoints(start)} -> ${withPoints(end)}`)
console.log(`  edges on another connection point: ${handleChanges}`)
console.log(`  routing styles: ${JSON.stringify(routings)}`)
