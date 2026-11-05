#!/usr/bin/env node
// Validate one or more .chd diagram files for structural integrity.
// Plain Node (no dependencies) so it runs anywhere the app does — no Python needed.
//
// Checks (see references/field-reference.md and references/authoring-guide.md
// for the rules behind each of these):
//
//   ERRORS (structural corruption):
//     - invalid JSON
//     - duplicate node id / duplicate edge id
//     - edge source/target referencing a node id that doesn't exist
//     - a node's parentId resolves to a real node, but that parent appears
//       LATER in the `nodes` array (violates the parent-before-child ordering
//       React Flow requires)
//     - a parentId cycle (A inside B inside A)
//     - an edge sourceHandle/targetHandle (also inside directionSets) that is not one of
//       its node's connection points: the edge is not drawn
//
//   WARNINGS (recoverable at runtime, but almost always a mistake):
//     - a parentId that doesn't resolve to any node in the file
//     - a relative path (custom icon, data.notes, data.linkedDiagram,
//       data.references entry) that doesn't resolve to a file on disk,
//       resolved relative to THIS FILE'S OWN DIRECTORY -- the most common
//       class of bug when a node is hand-edited or copied between diagrams
//       at different folder depths.
//
// Usage:
//   node validate_chd.mjs path/to/diagram.chd [more.chd ...]
//   node validate_chd.mjs path/to/diagram.chd --recursive   # also follow linkedDiagram targets
//
// Exit code is 1 if any ERROR was found in any file, 0 otherwise (warnings
// alone don't fail the run, but are always printed).

import { existsSync, readFileSync } from 'node:fs'
import { basename, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { hiddenLabels } from './label_clearance.mjs'

const SIDES = ['top', 'right', 'bottom', 'left']
// Only these carry connection points; 'shape' is the legacy name the app still reads as 'entity'.
const HANDLE_NODE_TYPES = new Set(['entity', 'container', 'shape'])

function load(path) {
  let text
  try {
    text = readFileSync(path, 'utf-8')
  } catch (e) {
    return { data: null, errors: [`cannot read file: ${e.message}`] }
  }
  try {
    return { data: JSON.parse(text), errors: [] }
  } catch (e) {
    return { data: null, errors: [`invalid JSON: ${e.message}`] }
  }
}

// Stored paths always use forward slashes; tolerate backslashes from
// older/hand-edited files the same way a lenient reader should.
function resolveRef(baseDir, ref) {
  return resolve(baseDir, ref.replaceAll('\\', '/'))
}

// An edge label wider than the gap between the two elements it joins is partly hidden behind them
// (references/layout-guide.md, "Elements joined by an edge"). The geometry is label_clearance.mjs, a
// generated copy of the app's own src/shared/layout/labelClearance.ts, so this script, the app's
// Diagnostics panel and the extension agree. It is an estimate, so this only warns.
function hiddenLabelWarnings(prefix, nodes, edges, diagramFont) {
  const found = hiddenLabels(nodes, edges, diagramFont).map((hidden) => {
    const label = hidden.label.length > 30 ? hidden.label.slice(0, 29) + '…' : hidden.label
    return `${prefix} edge '${hidden.edgeId}' ("${label}") has ${Math.round(hidden.gap)}px between '${hidden.sourceId}' and '${hidden.targetId}', but its label needs about ${hidden.needed}px: it will be hidden behind them (layout guide, "Elements joined by an edge")`
  })
  const shown = found.slice(0, 5)
  if (found.length > shown.length) {
    shown.push(
      `${prefix} ${found.length - shown.length} more edge label(s) are wider than the gap they sit in`
    )
  }
  return shown
}

export function validateFile(path, recursive = false, visited = new Set()) {
  const abs = resolve(path)
  if (visited.has(abs)) return { errors: [], warnings: [] }
  visited.add(abs)

  const errors = []
  const warnings = []
  const prefix = `[${path}]`

  const { data, errors: loadErrors } = load(path)
  if (loadErrors.length > 0) return { errors: loadErrors.map((e) => `${prefix} ${e}`), warnings }

  const baseDir = dirname(abs)
  const nodes = Array.isArray(data?.nodes) ? data.nodes : []
  const edges = Array.isArray(data?.edges) ? data.edges : []

  // --- legacy names ---
  // Names the app still reads but never writes. They work, but new files should use the
  // current name. One line per legacy name: a file written wholesale can have dozens.
  const legend = Array.isArray(data?.legend) ? data.legend : []
  const security = data?.security && typeof data.security === 'object' ? data.security : {}
  const idOf = (x) => x?.id ?? '<no id>'
  for (const { what, ids, old, current } of [
    {
      what: 'node(s)',
      ids: nodes.filter((n) => n?.type === 'shape').map(idOf),
      old: "type 'shape'",
      current: "type 'entity'"
    },
    {
      what: 'node(s)',
      ids: nodes.filter((n) => n?.data && 'details' in n.data).map(idOf),
      old: 'data.details',
      current: 'data.notes'
    },
    {
      what: 'legend entry(ies)',
      ids: legend.filter((e) => e?.kind === 'shape').map(idOf),
      old: "kind 'shape'",
      current: "kind 'entity'"
    },
    {
      what: 'security key(s)',
      ids: ['matrixShapeIds', 'hiddenShapeIds'].filter((k) => k in security),
      old: 'matrixShapeIds / hiddenShapeIds',
      current: 'matrixEntityIds / hiddenEntityIds'
    }
  ]) {
    if (ids.length === 0) continue
    const shown = ids
      .slice(0, 5)
      .map((id) => `'${id}'`)
      .join(', ')
    const more = ids.length > 5 ? `, and ${ids.length - 5} more` : ''
    warnings.push(
      `${prefix} ${ids.length} ${what} use the legacy ${old} (${shown}${more}); write ${current}`
    )
  }

  // --- id uniqueness ---
  const nodeIds = new Map()
  nodes.forEach((node, i) => {
    const nid = node?.id
    if (nid === undefined || nid === null) {
      errors.push(`${prefix} node at index ${i} has no id`)
      return
    }
    if (nodeIds.has(nid)) {
      errors.push(`${prefix} duplicate node id '${nid}' (indices ${nodeIds.get(nid)} and ${i})`)
    } else {
      nodeIds.set(nid, i)
    }
  })

  const edgeIds = new Set()
  edges.forEach((edge, i) => {
    const eid = edge?.id
    if (eid === undefined || eid === null) {
      errors.push(`${prefix} edge at index ${i} has no id`)
      return
    }
    if (edgeIds.has(eid)) errors.push(`${prefix} duplicate edge id '${eid}'`)
    edgeIds.add(eid)
  })

  // --- parent/child ordering + cycles ---
  for (const [nid, i] of nodeIds) {
    const parentId = nodes[i].parentId
    if (parentId === undefined || parentId === null) continue
    if (!nodeIds.has(parentId)) {
      warnings.push(
        `${prefix} node '${nid}' has parentId '${parentId}' which doesn't resolve to any node in this file (a reader will drop it and treat '${nid}' as top-level)`
      )
      continue
    }
    const parentIndex = nodeIds.get(parentId)
    if (parentIndex >= i) {
      errors.push(
        `${prefix} node '${nid}' (index ${i}) has parentId '${parentId}' (index ${parentIndex}) -- the parent must appear EARLIER in the nodes array`
      )
    }
    // cycle check: walk up the parent chain
    const seen = new Set([nid])
    let cur = parentId
    let depth = 0
    while (cur !== undefined && cur !== null && depth < nodes.length + 1) {
      if (seen.has(cur)) {
        errors.push(`${prefix} parentId cycle involving node '${nid}'`)
        break
      }
      seen.add(cur)
      cur = nodeIds.has(cur) ? nodes[nodeIds.get(cur)].parentId : null
      depth += 1
    }
  }

  // --- edge endpoint references ---
  for (const edge of edges) {
    const eid = edge?.id ?? '<no id>'
    for (const field of ['source', 'target']) {
      const endpoint = edge?.[field]
      if (endpoint !== undefined && endpoint !== null && !nodeIds.has(endpoint)) {
        errors.push(
          `${prefix} edge '${eid}' has ${field}='${endpoint}' which doesn't match any node id in this file`
        )
      }
    }
  }

  // --- edge connection points (handles) ---
  // An edge that names a connection point its node lacks is not drawn, and nothing else says so.
  // A side with no stored points has one implicit point named after the side; once a side has
  // stored points only those ids exist on it, so the side name stops being valid there.
  const handleIds = (node) => {
    const stored = Array.isArray(node?.connectionPoints) ? node.connectionPoints : []
    const ids = new Set()
    for (const side of SIDES) {
      const onSide = stored.filter((p) => p?.side === side)
      if (onSide.length === 0) ids.add(side)
      for (const p of onSide) ids.add(p?.id)
    }
    return ids
  }
  const checkHandle = (eid, where, nodeId, handle) => {
    if (handle === undefined || handle === null) return
    const node = nodeIds.has(nodeId) ? nodes[nodeIds.get(nodeId)] : undefined
    if (!node || !HANDLE_NODE_TYPES.has(node.type)) return
    const ids = handleIds(node)
    if (!ids.has(handle)) {
      errors.push(
        `${prefix} edge '${eid}' ${where}='${handle}' is not a connection point of node '${nodeId}' (it has: ${[...ids].join(', ')}); the edge will not be drawn`
      )
    }
  }
  for (const edge of edges) {
    const eid = edge?.id ?? '<no id>'
    checkHandle(eid, 'sourceHandle', edge?.source, edge?.sourceHandle)
    checkHandle(eid, 'targetHandle', edge?.target, edge?.targetHandle)
    for (const [setId, dir] of Object.entries(edge?.directionSets ?? {})) {
      checkHandle(eid, `directionSets.${setId}.sourceHandle`, dir?.source, dir?.sourceHandle)
      checkHandle(eid, `directionSets.${setId}.targetHandle`, dir?.target, dir?.targetHandle)
    }
  }

  // --- relative path resolution ---
  const checkPath = (context, ref) => {
    if (!ref) return null
    const target = resolveRef(baseDir, ref)
    if (!existsSync(target)) {
      warnings.push(`${prefix} ${context} points to '${ref}' -> resolves to '${target}' which does not exist`)
    }
    return target
  }

  const linkedDiagrams = []
  for (const node of nodes) {
    const nid = node?.id ?? '<no id>'
    const d = node?.data ?? {}
    for (const [slot, icon] of Object.entries(d.icons ?? {})) {
      if (icon && typeof icon === 'object' && icon.source === 'custom') {
        checkPath(`node '${nid}' icons.${slot}`, icon.path)
      }
    }
    if (d.notes) checkPath(`node '${nid}' data.notes`, d.notes)
    // `details` is the older name of `notes`; the app still reads it.
    if (d.details) checkPath(`node '${nid}' data.details`, d.details)
    if (d.linkedDiagram) {
      const target = checkPath(`node '${nid}' data.linkedDiagram`, d.linkedDiagram)
      if (target && existsSync(target)) linkedDiagrams.push(target)
    }
    for (const ref of d.references ?? []) checkPath(`node '${nid}' data.references[]`, ref)
  }

  for (const entry of data?.legend ?? []) {
    const icon = entry?.icon
    if (icon && typeof icon === 'object' && icon.source === 'custom') {
      checkPath(`legend entry '${entry.id ?? '?'}' icon`, icon.path)
    }
  }

  warnings.push(
    ...hiddenLabelWarnings(
      prefix,
      nodes,
      edges,
      typeof data?.fontFamily === 'string' ? data.fontFamily : undefined
    )
  )

  if (recursive) {
    for (const target of linkedDiagrams) {
      const sub = validateFile(target, true, visited)
      errors.push(...sub.errors)
      warnings.push(...sub.warnings)
    }
  }

  return { errors, warnings }
}

// Exported so the app's `chd validate` command (resources/cli) reuses it as-is.
export function main(argv) {
  const recursive = argv.includes('--recursive')
  const files = argv.filter((a) => !a.startsWith('--'))
  if (files.length === 0) {
    console.error('Usage: node validate_chd.mjs <file.chd> [more.chd ...] [--recursive]')
    return 2
  }
  let hadErrors = false
  for (const path of files) {
    const { errors, warnings } = validateFile(path, recursive)
    if (errors.length === 0 && warnings.length === 0) {
      console.log(`[${path}] OK`)
      continue
    }
    for (const e of errors) console.log(`ERROR   ${e}`)
    for (const w of warnings) console.log(`WARNING ${w}`)
    if (errors.length > 0) hadErrors = true
  }
  return hadErrors ? 1 : 0
}

// Run only when executed directly, so tests can import validateFile. The name check
// keeps this from firing when the file is bundled into another program (the Claude
// Desktop extension), where import.meta.url is that program's own file.
if (
  process.argv[1] &&
  basename(fileURLToPath(import.meta.url)) === 'validate_chd.mjs' &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  process.exit(main(process.argv.slice(2)))
}
