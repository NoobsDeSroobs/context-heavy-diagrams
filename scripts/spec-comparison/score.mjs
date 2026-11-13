// Scores the diagrams an assistant built from brief.md (epic 0177's comparison): completeness against the
// brief, structure, container insets, gaps and alignment. Usage: node score.mjs <platform.chd>...
// The layout problems themselves come from `chd ask inspect <file> --issues-only`.
import { readFileSync } from 'node:fs'

const BRIEF_NODES = {
  'Web shopper': 'out-top',
  'Mobile shopper': 'out-top',
  CDN: 'Edge',
  'API gateway': 'Edge',
  'Catalogue service': 'Service',
  'Cart service': 'Service',
  'Order service': 'Service',
  'Payment service': 'Service',
  'Search service': 'Service',
  'Notification service': 'Service',
  'Catalogue DB': 'Data',
  'Order DB': 'Data',
  'Session cache': 'Data',
  'Event bus': 'Data',
  'Card processor': 'out-bottom',
  'Email provider': 'out-bottom'
}
const BRIEF_EDGES = [
  ['Web shopper', 'CDN', 'loads pages'],
  ['Mobile shopper', 'API gateway', 'calls API'],
  ['CDN', 'API gateway', 'forwards requests'],
  ['API gateway', 'Catalogue service', 'browse'],
  ['API gateway', 'Cart service', 'add to cart'],
  ['API gateway', 'Order service', 'place order'],
  ['API gateway', 'Search service', 'search'],
  ['Catalogue service', 'Catalogue DB', 'reads and writes'],
  ['Search service', 'Catalogue DB', 'indexes'],
  ['Cart service', 'Session cache', 'stores carts'],
  ['Order service', 'Order DB', 'saves orders'],
  ['Order service', 'Payment service', 'requests payment'],
  ['Order service', 'Event bus', 'publishes order events'],
  ['Payment service', 'Card processor', 'charges card'],
  ['Event bus', 'Notification service', 'delivers events'],
  ['Notification service', 'Email provider', 'sends email']
]

const norm = (s) => (s ?? '').toLowerCase().replace(/\s+/g, ' ').trim()

function score(file) {
  const d = JSON.parse(readFileSync(file, 'utf-8'))
  const byId = new Map(d.nodes.map((n) => [n.id, n]))
  const abs = (n) => {
    let x = n.position.x,
      y = n.position.y
    for (let p = byId.get(n.parentId); p; p = byId.get(p.parentId)) {
      x += p.position.x
      y += p.position.y
    }
    return { x, y, w: n.size.width, h: n.size.height }
  }
  const labelOf = (n) => norm(n.data.label)
  const byLabel = new Map(d.nodes.map((n) => [labelOf(n), n]))
  const out = {
    nodes: d.nodes.length,
    edges: d.edges.length,
    containers: d.nodes.filter((n) => n.type === 'container').length
  }

  const missingNodes = Object.keys(BRIEF_NODES).filter((l) => !byLabel.has(norm(l)))
  out.missingNodes = missingNodes
  const edgeLookup = d.edges.map((e) => ({
    from: labelOf(byId.get(e.source)),
    to: labelOf(byId.get(e.target)),
    label: norm(e.data?.label ?? e.label)
  }))
  out.missingEdges = BRIEF_EDGES.filter(
    ([f, t, l]) =>
      !edgeLookup.some((e) => e.from === norm(f) && e.to === norm(t) && e.label === norm(l))
  ).map((e) => e.join(' > '))
  out.extraNodes = d.nodes
    .filter(
      (n) => n.type !== 'container' && !Object.keys(BRIEF_NODES).map(norm).includes(labelOf(n))
    )
    .map((n) => n.data.label)

  // structure: boundary and layers
  const containers = d.nodes.filter((n) => n.type === 'container')
  const top = containers.filter((c) => !c.parentId)
  const layers = containers.filter((c) => c.parentId)
  out.boundaryAtTop =
    top.length === 1 && layers.length === 3 && layers.every((l) => l.parentId === top[0].id)
  out.layerLabels = layers.map((l) => l.data.label)
  const wrong = []
  for (const [label, where] of Object.entries(BRIEF_NODES)) {
    const n = byLabel.get(norm(label))
    if (!n) continue
    const parent = byId.get(n.parentId)
    const inLayer = parent && parent.parentId
    if (where.startsWith('out')) {
      if (n.parentId) wrong.push(label)
    } else if (!inLayer || !norm(parent.data.label).includes(norm(where))) wrong.push(label)
  }
  out.wrongPlacement = wrong

  // insets: smallest clear space between a container edge and its children, per container
  const insets = {}
  for (const c of containers) {
    const kids = d.nodes.filter((n) => n.parentId === c.id)
    if (!kids.length) continue
    const r = abs(c)
    const k = kids.map(abs)
    insets[c.data.label] = Math.round(
      Math.min(
        Math.min(...k.map((a) => a.x)) - r.x,
        Math.min(...k.map((a) => a.y)) - r.y,
        r.x + r.w - Math.max(...k.map((a) => a.x + a.w)),
        r.y + r.h - Math.max(...k.map((a) => a.y + a.h))
      )
    )
  }
  out.minInset = insets

  // gaps: nearest-neighbour clear space between all non-container boxes, joined or not
  const solid = d.nodes.filter((n) => n.type !== 'container')
  const joined = new Set(
    d.edges.flatMap((e) => [`${e.source}|${e.target}`, `${e.target}|${e.source}`])
  )
  let minJoined = Infinity,
    minUnjoined = Infinity
  for (let i = 0; i < solid.length; i++)
    for (let j = i + 1; j < solid.length; j++) {
      const a = abs(solid[i]),
        b = abs(solid[j])
      const gx = Math.max(b.x - (a.x + a.w), a.x - (b.x + b.w))
      const gy = Math.max(b.y - (a.y + a.h), a.y - (b.y + b.h))
      const gap = Math.max(gx, gy) // clear space along the separating axis
      if (joined.has(`${solid[i].id}|${solid[j].id}`)) minJoined = Math.min(minJoined, gap)
      else if (gx > 0 || gy > 0) minUnjoined = Math.min(minUnjoined, gap)
    }
  out.minGapJoined = Math.round(minJoined)
  out.minGapUnjoined = Math.round(minUnjoined)

  // alignment: how many distinct row y's / column x's (rounded) within each layer
  const rows = {}
  for (const l of layers) {
    const kids = d.nodes.filter((n) => n.parentId === l.id).map(abs)
    rows[l.data.label] = {
      distinctY: new Set(kids.map((k) => Math.round(k.y))).size,
      kids: kids.length
    }
  }
  out.rowsPerLayer = rows
  const all = d.nodes.map(abs)
  out.canvas = `${Math.round(Math.max(...all.map((a) => a.x + a.w)) - Math.min(...all.map((a) => a.x)))} x ${Math.round(Math.max(...all.map((a) => a.y + a.h)) - Math.min(...all.map((a) => a.y)))}`
  out.edgesWithHandles = d.edges.filter((e) => e.sourceHandle && e.targetHandle).length
  out.styledNodes = d.nodes.filter((n) => n.style && Object.keys(n.style).length).length
  out.bytes = readFileSync(file).length
  return out
}

for (const f of process.argv.slice(2)) {
  console.log('==', f)
  console.log(JSON.stringify(score(f), null, 1))
}
