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

// An edge label is a chip centred on the edge's midpoint: about 6.5px a character at the default 12px
// font plus 14px of padding and border, and 23px tall. When the clear space between the two connected
// elements, along the direction the edge mostly runs, is smaller than the chip, the label is partly
// hidden behind them. The figures are an estimate (references/layout-guide.md, "Elements joined by an
// edge"), so this only warns, and only where the label certainly does not fit.
const LABEL_CHAR_PX = 6.5
const LABEL_PADDING_PX = 14
const LABEL_HEIGHT_PX = 23
const PLAIN_SIDES = new Set(['left', 'right', 'top', 'bottom'])

function hiddenLabelWarnings(prefix, nodes, edges) {
  const byId = new Map(nodes.filter((n) => n && n.id !== undefined).map((n) => [n.id, n]))
  const parentOf = (n) => (n.parentId === undefined ? undefined : byId.get(n.parentId))
  const isInside = (n, ancestorId) => {
    for (let p = parentOf(n), hops = 0; p && hops < 100; p = parentOf(p), hops += 1) {
      if (p.id === ancestorId) return true
    }
    return false
  }
  // Absolute position: a child's `position` is relative to its parent container.
  const rectOf = (n) => {
    let x = n.position?.x
    let y = n.position?.y
    const width = n.size?.width
    const height = n.size?.height
    if (![x, y, width, height].every(Number.isFinite)) return null
    for (let p = parentOf(n), hops = 0; p && hops < 100; p = parentOf(p), hops += 1) {
      if (!Number.isFinite(p.position?.x) || !Number.isFinite(p.position?.y)) return null
      x += p.position.x
      y += p.position.y
    }
    return { x, y, width, height }
  }

  const found = []
  for (const edge of edges) {
    const label = typeof edge?.label === 'string' ? edge.label.trim() : ''
    if (label === '') continue
    // Bend points or a moved label put the chip somewhere other than the middle of the gap.
    if (Array.isArray(edge.points) && edge.points.length > 0) continue
    const position = edge.style?.labelPosition
    if (position !== undefined && position !== 0.5) continue
    const a = byId.get(edge.source)
    const b = byId.get(edge.target)
    if (!a || !b || a === b || a.type === 'line' || b.type === 'line') continue
    if (isInside(a, b.id) || isInside(b, a.id)) continue
    const ra = rectOf(a)
    const rb = rectOf(b)
    if (!ra || !rb) continue

    const gapX = Math.max(rb.x - (ra.x + ra.width), ra.x - (rb.x + rb.width))
    const gapY = Math.max(rb.y - (ra.y + ra.height), ra.y - (rb.y + rb.height))
    if (gapX <= 0 && gapY <= 0) continue // overlapping elements: a different problem
    const horizontal = gapX > 0 && (gapY <= 0 || gapX >= gapY)
    const gap = horizontal ? gapX : gapY
    // An edge that leaves by the far side of an element loops round it: the label is not in the gap.
    const aIsFirst = horizontal ? ra.x < rb.x : ra.y < rb.y
    const [firstSide, secondSide] = horizontal ? ['right', 'left'] : ['bottom', 'top']
    const faces = (handle, isFirst) =>
      !PLAIN_SIDES.has(handle) || handle === (isFirst ? firstSide : secondSide)
    if (!faces(edge.sourceHandle, aIsFirst) || !faces(edge.targetHandle, !aIsFirst)) continue
    const scale = (Number.isFinite(edge.style?.fontSize) ? edge.style.fontSize : 12) / 12
    const longestLine = Math.max(...label.split('\n').map((line) => [...line].length))
    const needed = horizontal
      ? Math.ceil(LABEL_CHAR_PX * scale * longestLine + LABEL_PADDING_PX)
      : Math.ceil(LABEL_HEIGHT_PX * scale)
    if (gap < needed) {
      found.push(
        `${prefix} edge '${edge.id ?? '?'}' ("${label.length > 30 ? label.slice(0, 29) + '…' : label}") has ${Math.round(gap)}px between '${a.id}' and '${b.id}', but its label needs about ${needed}px: it will be hidden behind them (layout guide, "Elements joined by an edge")`
      )
    }
  }
  const shown = found.slice(0, 5)
  if (found.length > shown.length) {
    shown.push(`${prefix} ${found.length - shown.length} more edge label(s) are wider than the gap they sit in`)
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

  warnings.push(...hiddenLabelWarnings(prefix, nodes, edges))

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
