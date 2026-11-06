// The operations that describe an element rather than draw it: tags, required tags, highlights, the
// legend, a link and a note. Every result must be a file the app reads back unchanged.
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { validateFile } from '../../../resources/ai/skills/chd-diagrams/scripts/validate_chd.mjs'
import { createEmptyDiagram, parseDiagram, serializeDiagram } from '../diagram/index.ts'
import { describeDiagram } from './inspect.ts'
import { applyOperations, OperationError } from './operations.ts'

let counter = 0
const options = { newId: (prefix) => `${prefix}-${(counter += 1)}`, notesFolder: 'd/notes' }
const run = (diagram, ...ops) => applyOperations(diagram, ops, options)
const start = () => createEmptyDiagram()

function assertValid(diagram) {
  const dir = mkdtempSync(join(tmpdir(), 'chd-annotate-'))
  try {
    const file = join(dir, 'd.chd')
    const text = serializeDiagram(diagram)
    assert.deepEqual(serializeDiagram(parseDiagram(text)), text, 'round-trips through the app')
    writeFileSync(file, text)
    assert.deepEqual(validateFile(file).errors, [])
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

const refused = (diagram, op, pattern) =>
  assert.throws(
    () => run(diagram, op),
    (error) => error instanceof OperationError && pattern.test(error.message)
  )

const base = () =>
  run(
    start(),
    { op: 'add_entity', id: 'api', label: 'API', x: 0, y: 0, tags: { owner: 'platform' } },
    { op: 'add_entity', id: 'db', label: 'DB', x: 300, y: 0 },
    { op: 'add_text', id: 'note', label: 'Hello', x: 0, y: 200 },
    { op: 'connect', id: 'e1', from: 'api', to: 'db', label: 'reads' }
  ).diagram

test('tags are given when an element is made, set, changed and removed, on entities and edges', () => {
  const made = base()
  assert.deepEqual(made.nodes[0].metadata, { owner: { value: 'platform' } })
  const { diagram, results } = run(
    made,
    { op: 'set_tag', id: 'api', key: 'tier', value: 1 },
    { op: 'set_tag', id: 'api', key: 'owner', value: 'payments' },
    { op: 'set_tag', id: 'e1', key: 'protocol', value: ['http', 'grpc'] },
    { op: 'remove_tag', id: 'api', key: 'tier' }
  )
  assert.deepEqual(results[1].tags, { owner: 'payments', tier: 1 })
  assert.deepEqual(results[3].tags, { owner: 'payments' })
  assert.deepEqual(diagram.edges[0].metadata, { protocol: { value: ['http', 'grpc'] } })
  assertValid(diagram)
})

test('tags are refused on text, on unknown elements and when removing what is not there', () => {
  const made = base()
  refused(
    made,
    { op: 'set_tag', id: 'note', key: 'a', value: 1 },
    /only entities, containers and edges/
  )
  refused(made, { op: 'set_tag', id: 'nope', key: 'a', value: 1 }, /not an element/)
  refused(made, { op: 'set_tag', id: 'api', key: 'a' }, /"value" is required/)
  refused(made, { op: 'remove_tag', id: 'api', key: 'missing' }, /no tag "missing"/)
  refused(made, { op: 'add_text', x: 0, y: 0, tags: { a: 1 } }, /text element carries no tags/)
})

test('a required tag is seeded on new elements, backfilled on existing ones and checked on change', () => {
  const { diagram, results } = run(
    base(),
    {
      op: 'set_required_tag',
      key: 'environment',
      allowedValues: ['dev', 'prod'],
      defaultValue: 'dev'
    },
    { op: 'add_entity', id: 'cache', label: 'Cache', x: 600, y: 0, tags: { environment: 'prod' } },
    { op: 'set_tag', id: 'db', key: 'environment', value: 'prod' }
  )
  assert.deepEqual(results[0].requiredTag, {
    key: 'environment',
    allowedValues: ['dev', 'prod'],
    defaultValue: 'dev',
    lock: 'lockedEditable'
  })
  const env = (id) =>
    (diagram.nodes.find((n) => n.id === id) ?? diagram.edges.find((e) => e.id === id)).metadata
      .environment
  assert.deepEqual(env('api'), { value: 'dev', lock: 'lockedEditable' }, 'existing node backfilled')
  assert.deepEqual(env('e1'), { value: 'dev', lock: 'lockedEditable' }, 'existing edge backfilled')
  assert.deepEqual(env('cache'), { value: 'prod', lock: 'lockedEditable' })
  assert.deepEqual(env('db'), { value: 'prod', lock: 'lockedEditable' }, 'lock kept on set_tag')
  assert.equal(diagram.nodes.find((n) => n.id === 'note').metadata, undefined, 'text is left alone')
  assertValid(diagram)

  refused(
    diagram,
    { op: 'set_tag', id: 'api', key: 'environment', value: 'staging' },
    /allows only "dev", "prod"/
  )
  assert.doesNotThrow(() =>
    run(diagram, { op: 'set_tag', id: 'api', key: 'environment', value: null })
  )
  refused(diagram, { op: 'remove_tag', id: 'api', key: 'environment' }, /required tag/)
})

test('a fixed required tag cannot be changed, and a free tag on a newly required key is kept aside', () => {
  const { diagram, results } = run(
    base(),
    { op: 'set_tag', id: 'db', key: 'team', value: 'old' },
    { op: 'set_required_tag', key: 'team', lock: 'lockedStatic', defaultValue: 'core' }
  )
  assert.deepEqual(diagram.nodes[1].metadata.team, { value: 'core', lock: 'lockedStatic' })
  assert.deepEqual(diagram.nodes[1].metadata['team (demoted)'], { value: 'old' })
  assert.match(results[1].notices.join('\n'), /previous free value moved to "team \(demoted\)"/)
  refused(diagram, { op: 'set_tag', id: 'api', key: 'team', value: 'x' }, /fixed required tag/)
  assertValid(diagram)
})

test('remove_required_tag leaves the value behind as a free tag and drops the template when empty', () => {
  const withTag = run(base(), { op: 'set_required_tag', key: 'env', defaultValue: 'dev' }).diagram
  const { diagram, results } = run(withTag, { op: 'remove_required_tag', key: 'env' })
  assert.equal(diagram.requiredTags, undefined)
  assert.deepEqual(diagram.nodes[1].metadata, { env: { value: 'dev' } })
  assert.match(results[0].notices[0], /no longer required, kept as a free tag/)
  refused(diagram, { op: 'remove_required_tag', key: 'env' }, /not a required tag/)
  assertValid(diagram)
})

test('a required tag definition is checked', () => {
  const d = start()
  refused(d, { op: 'set_required_tag', key: '' }, /"key" must be a name/)
  refused(d, { op: 'set_required_tag', key: 'k', lock: 'open' }, /"lock" must be/)
  refused(d, { op: 'set_required_tag', key: 'k', allowedValues: [] }, /distinct, non-empty texts/)
  refused(d, { op: 'set_required_tag', key: 'k', allowedValues: ['a', 'a'] }, /distinct/)
  refused(
    d,
    { op: 'set_required_tag', key: 'k', allowedValues: ['a'], defaultValue: 'b' },
    /one of "allowedValues"/
  )
  // Changing a definition replaces it, in place.
  const { diagram } = run(
    d,
    { op: 'set_required_tag', key: 'a' },
    { op: 'set_required_tag', key: 'b' },
    { op: 'set_required_tag', key: 'a', lock: 'lockedStatic', defaultValue: 1 }
  )
  assert.deepEqual(
    diagram.requiredTags.map((t) => [t.key, t.lock]),
    [
      ['a', 'lockedStatic'],
      ['b', 'lockedEditable']
    ]
  )
})

test('tags on the diagram itself', () => {
  const { diagram, results } = run(
    base(),
    { op: 'set_diagram_tag', key: 'sourceBase', value: 'src/' },
    { op: 'set_diagram_tag', key: 'generated', value: true },
    { op: 'remove_diagram_tag', key: 'generated' }
  )
  assert.deepEqual(diagram.metadata, { sourceBase: 'src/' })
  assert.deepEqual(results[1].tags, { generated: true, sourceBase: 'src/' })
  refused(diagram, { op: 'remove_diagram_tag', key: 'generated' }, /no tag "generated"/)
  assert.equal(
    run(diagram, { op: 'remove_diagram_tag', key: 'sourceBase' }).diagram.metadata,
    undefined
  )
  assertValid(diagram)
})

test('highlights are added by key and value, recoloured in place and removed', () => {
  const { diagram } = run(
    base(),
    { op: 'set_highlight', key: 'environment', value: 'prod', color: '#e6194b' },
    { op: 'set_highlight', key: 'environment', value: 'dev', color: '#3cb44b' },
    { op: 'set_highlight', key: 'environment', value: 'prod', color: '#ff0000' }
  )
  assert.deepEqual(
    diagram.highlights.map((h) => [h.value, h.color]),
    [
      ['prod', '#ff0000'],
      ['dev', '#3cb44b']
    ]
  )
  assertValid(diagram)
  const left = run(diagram, { op: 'remove_highlight', key: 'environment', value: 'prod' }).diagram
  assert.equal(left.highlights.length, 1)
  refused(left, { op: 'remove_highlight', key: 'environment', value: 'prod' }, /no highlight/)
  assert.equal(
    run(left, { op: 'remove_highlight', key: 'environment', value: 'dev' }).diagram.highlights,
    undefined
  )
  refused(diagram, { op: 'set_highlight', key: 'k', value: 1 }, /"color" must be text/)
})

test('legend entries are added with the editor field order, changed, and removed', () => {
  const { diagram, results } = run(
    base(),
    {
      op: 'add_legend_entry',
      id: 'async',
      kind: 'line',
      label: 'Asynchronous',
      endMarker: 'arrowOpen',
      lineStyle: 'dashed',
      color: '#4a5568'
    },
    { op: 'add_legend_entry', kind: 'entity', label: 'Sensitive', color: '#e6194b' },
    { op: 'set_legend_entry', id: 'async', label: 'Async call', lineStyle: null, animation: 'flow' }
  )
  assert.match(results[1].legendEntry.id, /^legend-\d+$/, 'an id is made when none is given')
  assert.deepEqual(Object.keys(diagram.legend[0]), [
    'id',
    'kind',
    'label',
    'color',
    'endMarker',
    'animation'
  ])
  assert.equal(diagram.legend[0].label, 'Async call')
  assert.equal(diagram.legend[0].lineStyle, undefined)
  assert.equal(diagram.legend.length, 2)
  assertValid(diagram)
  const left = run(diagram, { op: 'remove_legend_entry', id: 'async' }).diagram
  assert.equal(left.legend.length, 1)
  assert.equal(
    run(left, { op: 'remove_legend_entry', id: left.legend[0].id }).diagram.legend,
    undefined
  )
})

test('a legend entry is checked', () => {
  const d = run(start(), { op: 'add_legend_entry', id: 'a', kind: 'entity', label: 'A' }).diagram
  refused(d, { op: 'add_legend_entry', kind: 'icon', label: 'x' }, /icon are not supported/)
  refused(d, { op: 'add_legend_entry', kind: 'box', label: 'x' }, /"kind" must be/)
  refused(d, { op: 'add_legend_entry', kind: 'line', label: ' ' }, /must not be empty/)
  refused(
    d,
    { op: 'add_legend_entry', id: 'a', kind: 'line', label: 'x' },
    /already a legend entry/
  )
  refused(
    d,
    { op: 'add_legend_entry', kind: 'entity', label: 'x', endMarker: 'arrowOpen' },
    /only apply to a legend entry of kind "line"/
  )
  refused(
    d,
    { op: 'add_legend_entry', kind: 'line', label: 'x', endMarker: 'nope' },
    /must be one of/
  )
  refused(d, { op: 'add_legend_entry', kind: 'line', label: 'x', size: 3 }, /not a style field/)
  refused(
    d,
    { op: 'set_legend_entry', id: 'zzz', label: 'x' },
    /not a legend entry \(the entries are a\)/
  )
})

test('a link goes on an entity or container, to a relative .chd path, and can be removed', () => {
  const { diagram, results } = run(
    base(),
    { op: 'link_to_existing_diagram', id: 'api', path: 'api\\Api.chd' },
    { op: 'link_to_existing_diagram', id: 'db', path: 'db/Db.chd' },
    { op: 'remove_link', id: 'db' }
  )
  assert.equal(diagram.nodes[0].data.linkedDiagram, 'api/Api.chd', 'stored with forward slashes')
  assert.equal(results[0].link, 'api/Api.chd')
  assert.equal(diagram.nodes[1].data.linkedDiagram, undefined)
  assertValid(diagram)
  refused(
    diagram,
    { op: 'link_to_existing_diagram', id: 'note', path: 'x.chd' },
    /only entities and containers/
  )
  refused(
    diagram,
    { op: 'link_to_existing_diagram', id: 'api', path: '/abs/x.chd' },
    /relative to this diagram/
  )
  refused(
    diagram,
    { op: 'link_to_existing_diagram', id: 'api', path: 'C:/x.chd' },
    /relative to this diagram/
  )
  refused(
    diagram,
    { op: 'link_to_existing_diagram', id: 'api', path: 'notes.md' },
    /another \.chd diagram/
  )
  refused(diagram, { op: 'remove_link', id: 'db' }, /has no link/)
})

test('the caller can refuse a stored path, and the refusal is the answer', () => {
  const refuse = {
    ...options,
    checkReference: (path) => (path.startsWith('..') ? 'outside the folder' : undefined)
  }
  assert.throws(
    () =>
      applyOperations(
        base(),
        [{ op: 'link_to_existing_diagram', id: 'api', path: '../x.chd' }],
        refuse
      ),
    /outside the folder/
  )
  assert.doesNotThrow(() =>
    applyOperations(base(), [{ op: 'link_to_existing_diagram', id: 'api', path: 'x.chd' }], refuse)
  )
})

test('a note is a Markdown file the caller writes, named after the label and the id', () => {
  const { diagram, files, results } = run(base(), {
    op: 'set_note',
    id: 'api',
    text: '# API\nTakes requests.'
  })
  assert.deepEqual(files, [{ path: 'd/notes/API-api.md', content: '# API\nTakes requests.\n' }])
  assert.equal(diagram.nodes[0].data.notes, 'd/notes/API-api.md')
  assert.equal(results[0].note, 'd/notes/API-api.md')
  assertValid(diagram)

  refused(diagram, { op: 'set_note', id: 'api', text: 'again' }, /already has a note/)
  refused(diagram, { op: 'set_note', id: 'note', text: 'x' }, /only entities and containers/)
  refused(diagram, { op: 'set_note', id: 'db', text: '  ' }, /must not be empty/)
  assert.throws(
    () =>
      applyOperations(base(), [{ op: 'set_note', id: 'db', text: 'x' }], { newId: options.newId }),
    /notes cannot be written here/
  )

  // Removing the note drops the reference only; the file is never deleted.
  const removed = run(diagram, { op: 'remove_note', id: 'api' })
  assert.equal(removed.diagram.nodes[0].data.notes, undefined)
  assert.deepEqual(removed.files, [])
  assert.deepEqual(removed.results[0].removed, ['d/notes/API-api.md'])
  refused(removed.diagram, { op: 'remove_note', id: 'api' }, /has no note/)
})

test('a note file name is safe whatever the label says', () => {
  const name = (label, id = 'n') =>
    run(start(), { op: 'add_entity', id, label, x: 0, y: 0 }, { op: 'set_note', id, text: 'x' })
      .files[0].path
  assert.equal(name('What/Why: "both"?'), 'd/notes/What Why both-n.md')
  assert.equal(name('..'), 'd/notes/note-n.md')
  assert.equal(name(''), 'd/notes/note-n.md')
  assert.equal(name('First line\nsecond line'), 'd/notes/First line-n.md')
  assert.equal(name('x'.repeat(100)), `d/notes/${'x'.repeat(60)}-n.md`)
})

test('a failing operation after a note changes nothing and asks for no file', () => {
  assert.throws(
    () =>
      run(
        base(),
        { op: 'set_note', id: 'api', text: 'x' },
        { op: 'set_tag', id: 'nope', key: 'a', value: 1 }
      ),
    (error) => error instanceof OperationError && error.index === 1
  )
})

test('describeDiagram shows tags, links, notes and the catalogs, and leaves out what is empty', () => {
  const plain = describeDiagram(base())
  assert.deepEqual(plain.nodes[0].tags, { owner: 'platform' })
  assert.equal('tags' in plain.nodes[1], false)
  assert.equal('requiredTags' in plain, false)
  assert.equal('legend' in plain, false)

  const { diagram } = run(
    base(),
    { op: 'set_required_tag', key: 'environment', defaultValue: 'dev' },
    { op: 'set_highlight', key: 'environment', value: 'dev', color: '#00ff00' },
    { op: 'add_legend_entry', id: 'l1', kind: 'entity', label: 'Dev', color: '#00ff00' },
    { op: 'set_diagram_tag', key: 'sourceBase', value: 'src/' },
    { op: 'link_to_existing_diagram', id: 'api', path: 'Api.chd' },
    { op: 'set_note', id: 'api', text: 'x' }
  )
  const described = describeDiagram(diagram)
  assert.deepEqual(described.nodes[0].tags, { environment: 'dev', owner: 'platform' })
  assert.equal(described.nodes[0].link, 'Api.chd')
  assert.equal(described.nodes[0].note, 'd/notes/API-api.md')
  assert.deepEqual(described.edges[0].tags, { environment: 'dev' })
  assert.equal(described.requiredTags.length, 1)
  assert.equal(described.highlights.length, 1)
  assert.equal(described.legend[0].id, 'l1')
  assert.deepEqual(described.diagramTags, { sourceBase: 'src/' })
})

test('add_new_linked_diagram names the file after the label in the folder of this diagram, never twice the same', () => {
  const taken = new Set(['d/Orders-1.chd'])
  const linked = { ...options, linkedFolder: 'd', fileExists: (path) => taken.has(path) }
  const { diagram, results } = applyOperations(
    base(),
    [
      { op: 'add_entity', id: 'o1', label: 'Orders\nthe order service', x: 0, y: 0 },
      { op: 'add_entity', id: 'o2', label: 'Orders', x: 0, y: 0 },
      { op: 'add_entity', id: 'o3', label: 'Orders', x: 0, y: 0 },
      { op: 'add_new_linked_diagram', id: 'o1' },
      { op: 'add_new_linked_diagram', id: 'o2' },
      { op: 'add_new_linked_diagram', id: 'o3', name: 'A/B?' },
      { op: 'link_to_existing_diagram', id: 'api', path: 'shared/Shared.chd' },
      { op: 'link_to_existing_diagram', id: 'db', path: 'd/Db.chd' }
    ],
    linked
  )
  assert.deepEqual(
    results.slice(3, 6).map((r) => r.link),
    ['d/Orders.chd', 'd/Orders-2.chd', 'd/A-B-.chd'],
    'the first line of the label, a numbered name when one is taken, here or on disk'
  )
  assert.equal(diagram.nodes.find((n) => n.id === 'o1').data.linkedDiagram, 'd/Orders.chd')
  assert.match(results[6].notices[0], /does not exist yet.*"d\/".*add_new_linked_diagram/)
  assert.equal(results[7].notices, undefined, 'a link inside the folder needs no remark')
  taken.add('shared/Shared.chd')
  const existing = applyOperations(
    diagram,
    [{ op: 'link_to_existing_diagram', id: 'db', path: 'shared/Shared.chd' }],
    linked
  )
  assert.equal(existing.results[0].notices, undefined, 'an existing diagram elsewhere is fine')
  assert.throws(
    () => applyOperations(diagram, [{ op: 'add_new_linked_diagram', id: 'o1' }], linked),
    /already links to d\/Orders\.chd/
  )
  refused(base(), { op: 'add_new_linked_diagram', id: 'api' }, /cannot be made here/)
})
