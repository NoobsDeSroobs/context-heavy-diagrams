// Run with `npm test` (Node's built-in runner; TypeScript is type-stripped).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { classifyDiagrams, describeCount, flattenReview } from './classify.ts'
import { diffCollections } from './collections.ts'
import { makeEdgesDrawable } from './drawable.ts'
import { EDGE_FIELDS, NODE_FIELDS } from './fields.ts'
import {
  EDGE_FIELDS as SAVE_EDGE_FIELDS,
  NODE_FIELDS as SAVE_NODE_FIELDS
} from '../document/changesSinceSave.ts'

const node = (id, over = {}) => ({
  id,
  type: 'entity',
  position: { x: 0, y: 0 },
  data: { label: `Node ${id}` },
  ...over
})
const edge = (id, source, target, over = {}) => ({ id, source, target, ...over })
const diagram = (nodes = [], edges = [], over = {}) => ({ version: 1, nodes, edges, ...over })

const statusOf = (c, id) => c.nodes.get(id)?.status
const lines = (c, id, field) => c.nodes.get(id).fields.find((f) => f.field === field).lines

// The review splits the style bag into the fields that carry meaning and a cosmetic rest; the
// save list keeps it whole, so a part counts under the name it covers.
const coveredNames = (fields) => [...new Set(fields.map((f) => f.covers ?? f.name))]

test('the field lists cover the same fields as "changes since last save"', () => {
  assert.deepEqual(
    coveredNames(NODE_FIELDS),
    SAVE_NODE_FIELDS.map((f) => f.name)
  )
  assert.deepEqual(
    coveredNames(EDGE_FIELDS),
    SAVE_EDGE_FIELDS.map((f) => f.name)
  )
})

test('nothing changed: nothing is classified', () => {
  const d = diagram([node('a')], [edge('e', 'a', 'a')])
  const c = classifyDiagrams(d, d)
  assert.equal(c.nodes.size, 0)
  assert.equal(c.edges.size, 0)
  assert.deepEqual(c.review, [])
  assert.deepEqual(c.diagramLevel, [])
})

test('added and removed elements; the removed one is kept in the merged diagram', () => {
  const base = diagram([node('gone')], [edge('e-gone', 'gone', 'gone')])
  const next = diagram([node('new')], [])
  const c = classifyDiagrams(base, next)
  assert.equal(statusOf(c, 'new'), 'added')
  assert.equal(statusOf(c, 'gone'), 'removed')
  assert.equal(c.edges.get('e-gone').status, 'removed')
  assert.deepEqual(
    c.merged.nodes.map((n) => n.id),
    ['new', 'gone']
  )
  assert.deepEqual(
    c.merged.edges.map((e) => e.id),
    ['e-gone']
  )
  assert.deepEqual(c.counts, {
    added: { nodes: 1, edges: 0 },
    removed: { nodes: 1, edges: 1 },
    links: { nodes: 0, edges: 0 },
    content: { nodes: 0, edges: 0 },
    restyled: { nodes: 0, edges: 0 }
  })
  assert.equal(describeCount(c.counts.removed), '1 element, 1 connection')
  assert.equal(describeCount(c.counts.links), '0')
})

test('label, tags, security and parent changes are yellow, and say what changed', () => {
  const threats = [{ id: 't1', name: 'Spoofing' }]
  const base = diagram(
    [
      node('a'),
      node('b', { metadata: { env: { value: 'dev' }, team: { value: 'x' } } }),
      node('c'),
      node('p', { data: { label: 'Parent' } }),
      node('s', { data: { label: 'S', security: { t1: { probability: 2, consequence: 3 } } } })
    ],
    [],
    { security: { threats, matrixEntityIds: ['s'] } }
  )
  const next = diagram(
    [
      node('a', { data: { label: 'Renamed' } }),
      node('b', { metadata: { env: { value: 'prod' }, pci: { value: 'yes' } } }),
      node('c', { parentId: 'p' }),
      node('p', { data: { label: 'Parent' } }),
      node('s', { data: { label: 'S', security: { t1: { probability: 4, consequence: 3 } } } })
    ],
    [],
    { security: { threats, matrixEntityIds: ['s'] } }
  )
  const c = classifyDiagrams(base, next)
  assert.equal(statusOf(c, 'a'), 'content')
  assert.deepEqual(lines(c, 'a', 'label'), ['label: "Node a" → "Renamed"'])
  assert.deepEqual(lines(c, 'b', 'tags'), ['~ env: "dev" → "prod"', '+ pci: "yes"', '− team: "x"'])
  assert.deepEqual(lines(c, 'c', 'parent'), ['container: (none) → "Parent"'])
  assert.deepEqual(lines(c, 's', 'security'), [
    '~ Spoofing: probability 2, consequence 3 → probability 4, consequence 3'
  ])
  assert.equal(c.nodes.get('s').security, true)
  assert.equal(statusOf(c, 'p'), undefined)
})

test('an edge changing its ends or its connection points is yellow, named by label', () => {
  const nodes = [node('a'), node('b'), node('c')]
  const base = diagram(nodes, [edge('e1', 'a', 'b'), edge('e2', 'a', 'b')])
  const next = diagram(nodes, [
    edge('e1', 'a', 'c'),
    edge('e2', 'a', 'b', { sourceHandle: 'cp-1' })
  ])
  const c = classifyDiagrams(base, next)
  const e1 = c.edges.get('e1')
  assert.equal(e1.status, 'content')
  assert.deepEqual(e1.fields[0].lines, ['to: "Node b" → "Node c"'])
  assert.equal(c.edges.get('e2').status, 'content')
})

test('a link or note path added, changed or removed is orange, and beats yellow', () => {
  const base = diagram([
    node('a'),
    node('b', { data: { label: 'B', linkedDiagram: 'old.chd' } }),
    node('c', { data: { label: 'C', notes: 'c/notes.md', references: ['x.png'] } })
  ])
  const next = diagram([
    node('a', { data: { label: 'A', linkedDiagram: 'new.chd' } }),
    node('b', { data: { label: 'B', linkedDiagram: 'other.chd' } }),
    node('c', { data: { label: 'C2', references: ['y.png'] } })
  ])
  const c = classifyDiagrams(base, next)
  assert.equal(statusOf(c, 'a'), 'links')
  assert.deepEqual(lines(c, 'a', 'linked diagram'), ['linked diagram: added "new.chd"'])
  assert.deepEqual(lines(c, 'b', 'linked diagram'), ['linked diagram: "old.chd" → "other.chd"'])
  assert.equal(statusOf(c, 'c'), 'links')
  assert.deepEqual(lines(c, 'c', 'note link'), ['Note file: removed (was "c/notes.md")'])
  assert.deepEqual(lines(c, 'c', 'reference images'), [
    'reference image: added "y.png"',
    'reference image: removed "x.png"'
  ])
})

test('a changed Note file the caller found turns an otherwise unchanged element orange', () => {
  const d = diagram([node('a'), node('b')])
  const c = classifyDiagrams(d, d, {
    notesContent: new Map([['a', { state: 'changed', preview: ['− owner: a', '+ owner: b'] }]])
  })
  assert.equal(statusOf(c, 'a'), 'links')
  assert.deepEqual(lines(c, 'a', 'Note file content'), [
    'Note file: content changed',
    '− owner: a',
    '+ owner: b'
  ])
  assert.equal(statusOf(c, 'b'), undefined)
})

test('only moving or a cosmetic restyle does not classify an element', () => {
  const base = diagram([node('a'), node('b')])
  const next = diagram([
    node('a', { position: { x: 400, y: 300 }, size: { width: 99, height: 50 } }),
    node('b', { style: { fontSize: 30 }, rotation: 12, locked: true })
  ])
  const c = classifyDiagrams(base, next)
  assert.equal(c.nodes.size, 0)
})

test('the review list puts security first, then links, content, removed and added', () => {
  const threats = [{ id: 't', name: 'T' }]
  const base = diagram(
    [
      node('content'),
      node('links'),
      node('removed'),
      node('sec', { data: { label: 'S', security: { t: { probability: 1, consequence: 1 } } } })
    ],
    [],
    { security: { threats, matrixEntityIds: ['sec'] } }
  )
  const next = diagram(
    [
      node('added'),
      node('content', { data: { label: 'changed' } }),
      node('links', { data: { label: 'Node links', linkedDiagram: 'x.chd' } }),
      node('sec', { data: { label: 'S', security: { t: { probability: 5, consequence: 1 } } } })
    ],
    [],
    { security: { threats, matrixEntityIds: ['sec'] } }
  )
  const c = classifyDiagrams(base, next)
  assert.deepEqual(
    c.review.map((r) => r.id),
    ['sec', 'links', 'content', 'removed', 'added']
  )
})

test('diagram-level changes are listed by collection', () => {
  const base = diagram([node('a')], [], {
    requiredTags: [{ key: 'env', lock: 'none' }],
    legend: [{ id: 'l1', kind: 'line', label: 'Old' }],
    maxConnectionPointsPerSide: 3
  })
  const next = diagram([node('a')], [], {
    requiredTags: [
      { key: 'env', lock: 'none' },
      { key: 'owner', lock: 'none' }
    ],
    legend: [{ id: 'l1', kind: 'line', label: 'Old', color: '#fff' }],
    maxConnectionPointsPerSide: 5,
    metadata: { owner: 'me' }
  })
  const changes = diffCollections(base, next)
  const byName = Object.fromEntries(changes.map((c) => [c.name, c]))
  assert.deepEqual(byName['Required tags'].added, ['owner'])
  assert.deepEqual(byName['Legend'].changed, ['Old'])
  assert.deepEqual(byName['Diagram tags'].added, ['owner'])
  assert.deepEqual(byName['Max connection points per side'].setting, { before: '3', after: '5' })
  assert.equal(byName['Highlights'], undefined)
})

test('every edge is drawable: a connection point the node lacks is moved to one it has', () => {
  // Right side holds custom points only, so the implicit "right" handle does not exist.
  const system = node('sys', {
    position: { x: 0, y: 0 },
    size: { width: 100, height: 100 },
    connectionPoints: [
      { id: 'cp-1', side: 'right', offset: 0.7 },
      { id: 'cp-2', side: 'right', offset: 0.4 }
    ]
  })
  const other = node('other', { position: { x: 400, y: 0 }, size: { width: 100, height: 100 } })
  const d = diagram(
    [system, other],
    [
      edge('named', 'sys', 'other', { sourceHandle: 'right', targetHandle: 'left' }),
      edge('unnamed', 'sys', 'other'),
      edge('unknown', 'sys', 'other', { sourceHandle: 'cp-9', targetHandle: 'left' }),
      edge('fine', 'sys', 'other', { sourceHandle: 'cp-1', targetHandle: 'left' }),
      edge('lost', 'sys', 'ghost')
    ]
  )
  const { diagram: fixed, repaired, dangling } = makeEdgesDrawable(d)
  const by = Object.fromEntries(fixed.edges.map((e) => [e.id, e]))
  assert.equal(by.named.sourceHandle, 'cp-2') // nearest the middle of the right side
  assert.equal(by.named.targetHandle, 'left')
  assert.equal(by.unknown.sourceHandle, 'cp-2') // the side facing the other node
  // No point named is drawable as it is: the canvas uses the node's first point.
  assert.equal(by.unnamed.sourceHandle, undefined)
  assert.deepEqual([...repaired].sort(), ['named', 'unknown'])
  assert.deepEqual(dangling, ['lost'])
  // The input is untouched: the comparison itself runs on the files as they are.
  assert.equal(d.edges[0].sourceHandle, 'right')
})

test('the view repairs edges, the merged diagram and the classification do not', () => {
  const sys = node('sys', { connectionPoints: [{ id: 'cp-1', side: 'right', offset: 0.5 }] })
  const other = node('other', { position: { x: 400, y: 0 } })
  const d = diagram([sys, other], [edge('e', 'sys', 'other', { sourceHandle: 'right' })])
  const c = classifyDiagrams(d, d)
  assert.equal(c.merged.edges[0].sourceHandle, 'right')
  assert.equal(c.view.edges[0].sourceHandle, 'cp-1')
  assert.deepEqual([...c.repairedEdges], ['e'])
  assert.equal(c.edges.size, 0)
})

test('a cosmetic look change earns the marker but no colour', () => {
  const base = diagram([node('a'), node('b'), node('c')], [edge('e', 'a', 'b')])
  const next = diagram(
    [
      node('a', { style: { fontSize: 20 } }),
      node('b', { data: { label: 'Renamed' }, style: { textAlign: 'end' } }),
      node('c', { position: { x: 90, y: 90 } })
    ],
    [edge('e', 'a', 'b', { style: { routingStyle: 'step', labelPosition: 0.2 } })]
  )
  const c = classifyDiagrams(base, next)
  assert.deepEqual([...c.restyledNodes].sort(), ['a', 'b'])
  assert.deepEqual([...c.restyledEdges], ['e'])
  // Not a colour; the rename still is.
  assert.equal(statusOf(c, 'a'), undefined)
  assert.equal(statusOf(c, 'b'), 'content')
  assert.equal(c.edges.get('e'), undefined)
})

test('a change to a counted node look is Restyled, with the old and new value', () => {
  const base = diagram([node('a', { style: { fill: '#ff0000', strokeWidth: 1 } })])
  const next = diagram([node('a', { style: { fill: '#00ff00', strokeWidth: 3 } })])
  const c = classifyDiagrams(base, next)
  assert.equal(statusOf(c, 'a'), 'restyled')
  assert.equal(c.counts.restyled.nodes, 1)
  assert.deepEqual(lines(c, 'a', 'fill'), ['fill: #ff0000 → #00ff00'])
  assert.deepEqual(lines(c, 'a', 'border width'), ['border width: 1 → 3'])
  assert.equal(c.restyledNodes.size, 0)
})

test('every counted look field is a change, on a node and on an edge', () => {
  const nodeChanges = {
    fill: '#111111',
    fillOpacity: 50,
    stroke: '#222222',
    strokeOpacity: 50,
    strokeWidth: 4,
    lineStyle: 'dotted',
    startMarker: 'arrowClosed',
    endMarker: 'diamond'
  }
  for (const [key, value] of Object.entries(nodeChanges)) {
    const c = classifyDiagrams(
      diagram([node('a')]),
      diagram([node('a', { style: { [key]: value } })])
    )
    assert.equal(statusOf(c, 'a'), 'restyled', `node ${key}`)
  }
  const edgeChanges = {
    stroke: '#333333',
    strokeOpacity: 50,
    strokeWidth: 4,
    lineStyle: 'dashed',
    startMarker: 'circle',
    endMarker: 'none',
    animation: 'flow',
    animationSpeed: 2,
    animationDirection: 'reverse',
    pulseDistance: 30,
    dashLength: 8,
    dashGap: 4
  }
  const ends = [node('a'), node('b')]
  for (const [key, value] of Object.entries(edgeChanges)) {
    const c = classifyDiagrams(
      diagram(ends, [edge('e', 'a', 'b')]),
      diagram(ends, [edge('e', 'a', 'b', { style: { [key]: value } })])
    )
    assert.equal(c.edges.get('e')?.status, 'restyled', `edge ${key}`)
  }
})

test('a line and an animation read in words', () => {
  const ends = [node('a'), node('b')]
  const c = classifyDiagrams(
    diagram(ends, [edge('e', 'a', 'b', { style: { lineStyle: 'solid' } })]),
    diagram(ends, [edge('e', 'a', 'b', { style: { lineStyle: 'dotted', animation: 'pulse' } })])
  )
  const fields = c.edges.get('e').fields
  assert.deepEqual(
    fields.map((f) => f.lines[0]),
    ['line style: solid → dotted', 'animation: none → pulse']
  )
})

test('icons are a counted look, told by name and corner', () => {
  const base = diagram([
    node('a', { data: { label: 'A', icons: { topLeft: { source: 'builtin', id: 'server' } } } })
  ])
  const next = diagram([
    node('a', {
      data: {
        label: 'A',
        icons: {
          topLeft: { source: 'builtin', id: 'database' },
          topRight: { source: 'custom', path: 'icons/own/lock.svg' }
        }
      }
    })
  ])
  const c = classifyDiagrams(base, next)
  assert.equal(statusOf(c, 'a'), 'restyled')
  assert.deepEqual(lines(c, 'a', 'icons'), [
    'icon, top left: "server" → "database"',
    'icon, top right: added "lock.svg"'
  ])
})

test('the stored colour is what is compared, so a theme flip is no change', () => {
  const same = { style: { fill: '#112233', stroke: '#445566' } }
  const c = classifyDiagrams(diagram([node('a', same)]), diagram([node('a', same)]))
  assert.equal(c.nodes.size, 0)
})

test('a restyle with another change keeps the stronger colour and lists both, strongest first', () => {
  const base = diagram([node('a', { style: { fill: '#ff0000' } })])
  const next = diagram([node('a', { data: { label: 'Renamed' }, style: { fill: '#00ff00' } })])
  const c = classifyDiagrams(base, next)
  assert.equal(statusOf(c, 'a'), 'content')
  assert.deepEqual(
    c.nodes.get('a').fields.map((f) => f.field),
    ['label', 'fill']
  )
  assert.equal(c.counts.content.nodes, 1)
  assert.equal(c.counts.restyled.nodes, 0)
})

test('restyled sits after modified and before removed in the review', () => {
  const base = diagram([
    node('gone'),
    node('moded'),
    node('styled', { style: { fill: '#111111' } })
  ])
  const next = diagram([
    node('moded', { data: { label: 'New name' } }),
    node('styled', { style: { fill: '#222222' } }),
    node('fresh')
  ])
  const c = classifyDiagrams(base, next)
  assert.deepEqual(
    c.review.map((i) => i.id),
    ['moded', 'styled', 'gone', 'fresh']
  )
})

test('a changed legend entry is still told at diagram level', () => {
  const base = diagram([], [], {
    legend: [{ id: 'l1', label: 'Planned', kind: 'line', style: { lineStyle: 'solid' } }]
  })
  const next = diagram([], [], {
    legend: [{ id: 'l1', label: 'Planned', kind: 'line', style: { lineStyle: 'dotted' } }]
  })
  const changes = classifyDiagrams(base, next).diagramLevel
  assert.deepEqual(
    changes.map((d) => [d.name, d.changed]),
    [['Legend', ['Planned']]]
  )
})

test('a label whose first line is the same shows the lines that changed', () => {
  const base = diagram([node('t', { data: { label: 'Title\nfirst note' } })])
  const next = diagram([node('t', { data: { label: 'Title\nfirst note\nNOTE: under review' } })])
  const c = classifyDiagrams(base, next)
  assert.deepEqual(lines(c, 't', 'label'), ['label, further lines:', '+ NOTE: under review'])
})

test('connections that came or went with an element sit under it, others stay their own rows', () => {
  const base = diagram(
    [node('a'), node('gone'), node('b'), node('c')],
    [
      edge('e1', 'a', 'gone'),
      edge('e2', 'gone', 'b'),
      edge('lone', 'a', 'b'),
      edge('changed', 'b', 'c')
    ]
  )
  const next = diagram(
    [node('a'), node('b'), node('c'), node('fresh')],
    [edge('changed', 'b', 'a'), edge('e3', 'fresh', 'a'), edge('e4', 'b', 'c')]
  )
  const c = classifyDiagrams(base, next)
  const gone = c.review.find((r) => r.id === 'gone')
  assert.deepEqual(gone.connections.map((r) => r.id).sort(), ['e1', 'e2'])
  const fresh = c.review.find((r) => r.id === 'fresh')
  assert.deepEqual(
    fresh.connections.map((r) => r.id),
    ['e3']
  )
  // Not folded in: a connection whose ends both survive, and one that only changed.
  const top = c.review.map((r) => r.id)
  assert.ok(top.includes('lone'))
  assert.ok(top.includes('changed'))
  assert.ok(!top.includes('e1') && !top.includes('e3'))
  // The totals still count every connection, and flattenReview lists them all.
  assert.equal(c.counts.removed.edges, 3)
  assert.equal(c.counts.added.edges, 2)
  assert.ok(flattenReview(c.review).some((r) => r.id === 'e2'))
})
