import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { checkDiagram } from './check.ts'
import { validateProfile } from './validate.ts'

const profilesDir = join(import.meta.dirname, '..', '..', '..', 'resources', 'profiles')
const shipped = (name) => {
  const { profile, errors } = validateProfile(
    JSON.parse(readFileSync(join(profilesDir, `${name}.chdprofile.json`), 'utf8'))
  )
  assert.deepEqual(errors, [])
  return profile
}

const node = (id, role, extra = {}) => ({
  id,
  type: 'entity',
  position: { x: 0, y: 0 },
  ...(role ? { metadata: { role: { value: role } } } : {}),
  data: { label: id },
  ...extra
})
const edge = (id, source, target, extra = {}) => ({ id, source, target, ...extra })
const diagram = (nodes, edges, sets = [{ id: 's1', name: 'Depends On' }]) => ({
  version: 1,
  edgeDirectionSets: sets,
  nodes,
  edges
})
const ids = (result) => result.findings.map((f) => f.ruleId).sort()

// A profile small enough to read in one go.
const mini = (rules, edges = { meaning: 'dependsOn', presence: 'optional' }) => {
  const { profile, errors } = validateProfile({
    profileVersion: 1,
    name: 'Mini',
    edges,
    roles: {
      a: { match: { tag: { key: 'role', value: 'a' } } },
      b: { match: { tag: { key: 'role', value: ['b', 'bee'] } } },
      box: { match: { type: 'container' } }
    },
    rules
  })
  assert.deepEqual(errors, [])
  return profile
}

test('a conforming hexagonal diagram has no findings', () => {
  const d = diagram(
    [
      node('hex', 'hexagon', { type: 'container' }),
      node('core', 'domain', { parentId: 'hex' }),
      node('in', 'port-in', { parentId: 'hex' }),
      node('rest', 'adapter-in')
    ],
    [edge('e1', 'rest', 'in'), edge('e2', 'core', 'in')]
  )
  const result = checkDiagram(d, shipped('hexagonal'))
  assert.deepEqual(result.findings, [])
  assert.equal(result.conforms, true)
})

test('a hexagonal diagram that breaks the style is reported rule by rule', () => {
  const d = diagram(
    [
      node('hex', 'hexagon', { type: 'container' }),
      node('core', 'domain'),
      node('in', 'port-in', { parentId: 'hex' }),
      node('rest', 'adapter-in', { parentId: 'hex' }),
      node('db', 'adapter-out'),
      node('x')
    ],
    [edge('e1', 'rest', 'db'), edge('e2', 'core', 'db')]
  )
  const result = checkDiagram(d, shipped('hexagonal'))
  assert.deepEqual(ids(result), [
    'adapter-outside-hexagon',
    'adapter-uses-port',
    'adapter-uses-port',
    'domain-inside-hexagon',
    'domain-not-on-adapter',
    'entity-has-role',
    'no-adapter-to-adapter',
    'port-has-adapter'
  ])
  assert.equal(result.conforms, false)
  const forbidden = result.findings.find((f) => f.ruleId === 'domain-not-on-adapter')
  assert.deepEqual(forbidden.edgeIds, ['e2'])
  assert.deepEqual(forbidden.nodeIds, ['core', 'db'])
  assert.equal(forbidden.detail, '"core" to "db"')
  assert.equal(forbidden.severity, 'error')
  assert.equal(result.findings.find((f) => f.ruleId === 'entity-has-role').severity, 'warning')
})

test('a missing edge set is a violation and the direction rules are listed as not evaluated', () => {
  const d = diagram(
    [node('a1', 'a'), node('a2', 'a', { parentId: 'nobody' })],
    [edge('e', 'a1', 'a2')],
    []
  )
  const result = checkDiagram(
    d,
    mini([
      { id: 'no-a-to-a', kind: 'forbiddenEdge', from: 'a', to: 'a' },
      { id: 'inside', kind: 'containment', each: 'a', mustBeInside: 'box' }
    ])
  )
  assert.deepEqual(ids(result), ['edge-set', 'inside', 'inside'])
  assert.match(
    result.findings.find((f) => f.ruleId === 'edge-set').message,
    /Missing required edge set/
  )
  assert.deepEqual(result.notEvaluated, ['no-a-to-a'])
  assert.equal(result.conforms, false)
})

test('the edge set name is matched ignoring case and whitespace, and must be unique', () => {
  const rule = [{ id: 'no-a-to-a', kind: 'forbiddenEdge', from: 'a', to: 'a' }]
  const nodes = [node('a1', 'a'), node('a2', 'a')]
  const edges = [edge('e', 'a1', 'a2')]
  const named = (name) => checkDiagram(diagram(nodes, edges, [{ id: 's', name }]), mini(rule))
  assert.deepEqual(ids(named('  depends   ON ')), ['no-a-to-a'])
  assert.deepEqual(ids(named('DependsOn')), ['no-a-to-a'])
  assert.deepEqual(ids(named('Flows To')), ['edge-set'])
  const twice = checkDiagram(
    diagram(nodes, edges, [
      { id: 's', name: 'Depends On' },
      { id: 't', name: 'dependson' }
    ]),
    mini(rule)
  )
  assert.match(twice.findings[0].message, /More than one edge direction set/)
})

test('with two or more sets the rules read the orientation of the matching set', () => {
  const nodes = [node('a1', 'a'), node('b1', 'b')]
  // Stored in the first set's orientation (a1 to b1); in the second set the edge runs b1 to a1.
  const edges = [
    edge('e', 'a1', 'b1', {
      directionSets: { flow: { source: 'a1', target: 'b1' }, dep: { source: 'b1', target: 'a1' } }
    })
  ]
  const sets = [
    { id: 'flow', name: 'Flows To' },
    { id: 'dep', name: 'Depends On' }
  ]
  const rule = [{ id: 'a-not-on-b', kind: 'forbiddenEdge', from: 'a', to: 'b' }]
  const dependsOn = checkDiagram(diagram(nodes, edges, sets), mini(rule))
  assert.deepEqual(ids(dependsOn), [])
  const flowsTo = checkDiagram(
    diagram(nodes, edges, sets),
    mini(rule, { meaning: 'flowsTo', presence: 'optional' })
  )
  assert.deepEqual(ids(flowsTo), ['a-not-on-b'])
})

test('edge presence: required and forbidden', () => {
  const nodes = [node('a1', 'a'), node('a2', 'a')]
  const none = checkDiagram(
    diagram(nodes, []),
    mini([], { meaning: 'dependsOn', presence: 'required' })
  )
  assert.deepEqual(ids(none), ['edge-presence'])
  const some = checkDiagram(
    diagram(nodes, [edge('e', 'a1', 'a2')], []),
    mini([], { meaning: 'irrelevant', presence: 'forbidden' })
  )
  assert.deepEqual(ids(some), ['edge-presence'])
  assert.deepEqual(some.findings[0].edgeIds, ['e'])
  const fine = checkDiagram(
    diagram(nodes, []),
    mini([], { meaning: 'dependsOn', presence: 'optional' })
  )
  assert.deepEqual(fine.findings, [])
})

test('roles are matched exactly after normalising: port is not support', () => {
  const rule = [{ id: 'no-b-to-b', kind: 'forbiddenEdge', from: 'b', to: 'b' }]
  const hit = (role) =>
    ids(
      checkDiagram(
        diagram([node('x', ' B E E '), node('y', role)], [edge('e', 'x', 'y')]),
        mini(rule)
      )
    )
  assert.deepEqual(hit('Bee'), ['no-b-to-b'])
  assert.deepEqual(hit('b'), ['no-b-to-b'])
  assert.deepEqual(hit('bees'), [])
  assert.deepEqual(hit('abb'), [])
})

test('the tag key is matched ignoring case and whitespace, a list value matches any member', () => {
  const x = node('x', undefined, { metadata: { ' ROLE ': { value: ['q', 'a'] } } })
  const y = node('y', undefined, { metadata: { role: { value: 'b' } } })
  const result = checkDiagram(
    diagram([x, y], [edge('e', 'x', 'y')]),
    mini([{ id: 'r', kind: 'forbiddenEdge', from: 'a', to: 'b' }])
  )
  assert.deepEqual(ids(result), ['r'])
})

test('required edge: outgoing, incoming and either', () => {
  const nodes = [node('a1', 'a'), node('a2', 'a'), node('b1', 'b')]
  const edges = [edge('e', 'a1', 'b1')]
  const run = (edgeDirection) =>
    checkDiagram(
      diagram(nodes, edges),
      mini([{ id: 'r', kind: 'requiredEdge', each: 'a', edge: edgeDirection, with: 'b' }])
    ).findings.flatMap((f) => f.nodeIds)
  assert.deepEqual(run('outgoing'), ['a2'])
  assert.deepEqual(run('incoming'), ['a1', 'a2'])
  assert.deepEqual(run('either'), ['a2'])
  const anyone = checkDiagram(
    diagram(nodes, edges),
    mini([{ id: 'r', kind: 'requiredEdge', each: 'b', edge: 'incoming', with: '*' }])
  )
  assert.deepEqual(anyone.findings, [])
})

test('containment looks through any depth of containers and ignores a loop in the data', () => {
  const nodes = [
    node('outer', undefined, { type: 'container' }),
    node('inner', undefined, { type: 'container', parentId: 'outer' }),
    node('deep', 'a', { parentId: 'inner' }),
    node('loose', 'a'),
    node('l1', 'a', { parentId: 'l2' }),
    node('l2', 'a', { parentId: 'l1' })
  ]
  const must = checkDiagram(
    diagram(nodes, []),
    mini([{ id: 'r', kind: 'containment', each: 'a', mustBeInside: 'box' }])
  )
  assert.deepEqual(must.findings.flatMap((f) => f.nodeIds).sort(), ['l1', 'l2', 'loose'])
  const mustNot = checkDiagram(
    diagram(nodes, []),
    mini([{ id: 'r', kind: 'containment', each: 'a', mustNotBeInside: 'box' }])
  )
  assert.deepEqual(
    mustNot.findings.flatMap((f) => f.nodeIds),
    ['deep']
  )
})

test('a role can require being inside another role', () => {
  const profile = validateProfile({
    profileVersion: 1,
    name: 'P',
    edges: { meaning: 'irrelevant', presence: 'optional' },
    roles: {
      zone: { match: { type: 'container', tag: { key: 'role', value: 'zone' } } },
      inzone: { match: { insideRole: 'zone' } }
    },
    rules: [{ id: 'few', kind: 'maxElements', of: 'inzone', max: 1, severity: 'warning' }]
  }).profile
  const nodes = [
    node('z', 'zone', { type: 'container' }),
    node('p', undefined, { parentId: 'z' }),
    node('q', undefined, { parentId: 'z' }),
    node('r')
  ]
  const result = checkDiagram(diagram(nodes, [], []), profile)
  assert.match(result.findings[0].message, /2 elements; the limit is 1/)
})

test('required property on elements and on edges, by label and by tag', () => {
  const nodes = [
    node('a1', 'a', { data: { label: '  ' } }),
    node('a2', 'a', { metadata: { role: { value: 'a' }, owner: { value: 'team' } } }),
    node('a3', 'a', { metadata: { role: { value: 'a' }, owner: { value: '' } } })
  ]
  const edges = [
    edge('e1', 'a1', 'a2', { label: 'calls' }),
    edge('e2', 'a2', 'a3'),
    edge('e3', 'a3', 'a1', { metadata: { kind: { value: 'sync' } } })
  ]
  const run = (each, property) =>
    checkDiagram(
      diagram(nodes, edges),
      mini([{ id: 'r', kind: 'requiredProperty', each, property }])
    )
  assert.deepEqual(
    run('a', 'label').findings.flatMap((f) => f.nodeIds),
    ['a1']
  )
  assert.deepEqual(
    run('a', { tag: 'owner' })
      .findings.flatMap((f) => f.nodeIds)
      .sort(),
    ['a1', 'a3']
  )
  assert.deepEqual(
    run('@edges', 'label').findings.flatMap((f) => f.edgeIds),
    ['e2', 'e3']
  )
  assert.deepEqual(
    run('@edges', { tag: 'kind' }).findings.flatMap((f) => f.edgeIds),
    ['e1', 'e2']
  )
})

test('maxElements counts entities, containers and text, never lines, and info does not fail', () => {
  const nodes = [
    node('a1'),
    node('c', undefined, { type: 'container' }),
    node('t', undefined, { type: 'text' }),
    node('line', undefined, { type: 'line' })
  ]
  const rules = (max) => [{ id: 'size', kind: 'maxElements', of: '*', max, severity: 'info' }]
  const over = checkDiagram(diagram(nodes, []), mini(rules(2)))
  assert.match(over.findings[0].message, /3 elements; the limit is 2/)
  assert.equal(over.findings[0].severity, 'info')
  assert.equal(over.conforms, true)
  assert.deepEqual(checkDiagram(diagram(nodes, []), mini(rules(3))).findings, [])
})

test('an edge to a node that does not exist is ignored', () => {
  const result = checkDiagram(
    diagram([node('a1', 'a')], [edge('e', 'a1', 'ghost')]),
    mini([{ id: 'r', kind: 'forbiddenEdge', from: '*', to: '*' }])
  )
  assert.deepEqual(result.findings, [])
})

test('the data-flow profile accepts a sound diagram and rejects store-to-store', () => {
  const flows = [{ id: 'f', name: 'Flows To' }]
  const sound = diagram(
    [node('user', 'external-entity'), node('orders', 'process'), node('db', 'data-store')],
    [
      edge('e1', 'user', 'orders', { label: 'order' }),
      edge('e2', 'orders', 'db', { label: 'row' }),
      edge('e3', 'orders', 'user', { label: 'receipt' })
    ],
    flows
  )
  assert.deepEqual(checkDiagram(sound, shipped('data-flow-diagram')).findings, [])
  const broken = diagram(
    [node('db1', 'data-store'), node('db2', 'data-store'), node('p', 'process')],
    [edge('e1', 'db1', 'db2', { label: 'copy' })],
    flows
  )
  const result = checkDiagram(broken, shipped('data-flow-diagram'))
  assert.deepEqual(ids(result), ['no-store-to-store', 'process-has-input', 'process-has-output'])
})
