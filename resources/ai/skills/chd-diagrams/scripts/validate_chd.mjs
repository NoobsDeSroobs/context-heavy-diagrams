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
//
//   WARNINGS (recoverable at runtime, but almost always a mistake):
//     - a parentId that doesn't resolve to any node in the file
//     - a relative path (custom icon, data.details, data.linkedDiagram,
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
