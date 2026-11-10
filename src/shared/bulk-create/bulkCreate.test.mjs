// Run with `npm test`. Pasting a table to create elements (ADR 0168): the table parser, which
// column means what, how rows merge into elements, and how tags meet the required tags.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { detectDelimiter, looksLikeTable, parseTable } from './table.ts'
import { buildElements, containerKeyOf, guessColumns, listElements } from './elements.ts'
import { prepareElements } from './prepare.ts'

// ---- parsing ----------------------------------------------------------------------------------

test('tabs mean a spreadsheet paste, anything else is commas', () => {
  assert.equal(detectDelimiter('a\tb\n1\t2'), '\t')
  assert.equal(detectDelimiter('a,b\n1,2'), ',')
  assert.equal(detectDelimiter('\n\nsolo'), ',')
})

test('a tab-separated paste is read cell by cell, trimmed', () => {
  assert.deepEqual(parseTable('Name\tOwner\r\n Billing \tteam-a\r\nLedger\t\r\n'), [
    ['Name', 'Owner'],
    ['Billing', 'team-a'],
    ['Ledger', '']
  ])
})

test('quotes hold commas, doubled quotes and line breaks', () => {
  assert.deepEqual(parseTable('a,b\n"x, y","say ""hi"""\n"two\nlines",z'), [
    ['a', 'b'],
    ['x, y', 'say "hi"'],
    ['two\nlines', 'z']
  ])
})

test('a quote in the middle of a word is a letter', () => {
  assert.deepEqual(parseTable('a,b\n5" pipe,ok'), [
    ['a', 'b'],
    ['5" pipe', 'ok']
  ])
})

test('blank rows are dropped and a missing last line break is fine', () => {
  assert.deepEqual(parseTable('a,b\n\n,\n1,2'), [
    ['a', 'b'],
    ['1', '2']
  ])
})

test('a table needs a header of two columns, a row, and no row wider than the header', () => {
  assert.equal(looksLikeTable(parseTable('Name,Owner\nA,x')), true)
  assert.equal(looksLikeTable(parseTable('Name,Owner\nA')), true)
  assert.equal(looksLikeTable(parseTable('Name,Owner')), false)
  assert.equal(looksLikeTable(parseTable('one\ntwo')), false)
  // labels with a comma: the second line is wider than the first
  assert.equal(looksLikeTable(parseTable('Smith\nDoe, Jane')), false)
})

// ---- columns ----------------------------------------------------------------------------------

test('headers are guessed by name, one column per role', () => {
  const roles = (header) => guessColumns(header).map((c) => c.role)
  assert.deepEqual(roles(['Name', 'Description', 'Domain', 'Owner']), [
    'label',
    'note',
    'container',
    'tag'
  ])
  // a second match is a tag, not lost
  assert.deepEqual(roles(['Title', 'Name', 'Note', 'Details']), ['label', 'tag', 'note', 'tag'])
  // no name column: the first one is the label
  assert.deepEqual(roles(['System', 'Owner']), ['label', 'tag'])
  assert.deepEqual(roles(['Owner', 'Group', '']), ['label', 'container', 'ignore'])
})

// ---- elements ---------------------------------------------------------------------------------

const columns = guessColumns(['Name', 'Description', 'Domain', 'Owner', 'Env'])
const build = (rows, type = 'entity', cols = columns) => buildElements(rows, cols, { type })

test('each row becomes an element with its note, container and tags', () => {
  const { elements, rows, blankLabelRows } = build([
    ['Billing', 'Charges', 'Payments', 'team-a', 'prod']
  ])
  assert.equal(rows, 1)
  assert.equal(blankLabelRows, 0)
  assert.deepEqual(elements, [
    {
      label: 'Billing',
      note: 'Charges',
      container: 'Payments',
      tags: { Owner: 'team-a', Env: 'prod' }
    }
  ])
})

test('an empty cell sets nothing, and a row with no label is left out', () => {
  const { elements, blankLabelRows } = build([
    ['A', '', '', '', 'dev'],
    ['', 'orphan', '', 'x', '']
  ])
  assert.deepEqual(elements, [{ label: 'A', tags: { Env: 'dev' } }])
  assert.equal(blankLabelRows, 1)
})

test('rows with the same label merge, the first value of a field wins and a clash is reported', () => {
  const { elements, conflicts } = build([
    ['A', 'first', '', 'team-a', 'dev'],
    ['A', '', 'G', 'team-a', 'prod'],
    ['A', 'second', '', 'team-b', '']
  ])
  assert.equal(elements.length, 1)
  assert.deepEqual(elements[0], {
    label: 'A',
    note: 'first',
    container: 'G',
    tags: { Owner: 'team-a', Env: 'dev' }
  })
  // in the order they were met: row by row, column by column
  assert.deepEqual(conflicts, [
    'A: Env is "dev" and "prod"; kept "dev"',
    'A: note is "first" and "second"; kept "first"',
    'A: Owner is "team-a" and "team-b"; kept "team-a"'
  ])
})

test('long form, one row per fact, gives the same element', () => {
  const long = [
    ['Name', 'Owner', 'Env'],
    ['A', 'team-a', ''],
    ['A', '', 'prod']
  ]
  const { elements } = buildElements(long.slice(1), guessColumns(long[0]), { type: 'entity' })
  assert.deepEqual(elements, [{ label: 'A', tags: { Owner: 'team-a', Env: 'prod' } }])
})

test('a container keeps its description as a tag, since a container has no note', () => {
  const { elements } = build([['Zone', 'The DMZ', '', '', '']], 'container')
  assert.deepEqual(elements, [{ label: 'Zone', tags: { description: 'The DMZ' } }])
})

test('the container column names the tag it is kept under until elements are grouped', () => {
  assert.equal(containerKeyOf(columns), 'Domain')
  assert.equal(containerKeyOf(guessColumns(['Name', 'Owner'])), undefined)
  assert.equal(containerKeyOf(guessColumns(['Name', 'Group'])), 'Group')
})

test('a column set by hand to a second label, note or container is kept as a tag', () => {
  const cols = guessColumns(['Name', 'Alias']).map((c) => ({ ...c, role: 'label' }))
  const { elements } = buildElements([['A', 'B']], cols, { type: 'entity' })
  assert.deepEqual(elements, [{ label: 'A', tags: { Alias: 'B' } }])
})

test('a list of labels is one element per line, without merging', () => {
  assert.deepEqual(listElements('A\n  B  \r\n\nA\n'), [
    { label: 'A', tags: {} },
    { label: 'B', tags: {} },
    { label: 'A', tags: {} }
  ])
})

// ---- tags and the required tags -----------------------------------------------------------------

const required = [
  {
    key: 'owner',
    allowedValues: ['team-a', 'team-b'],
    defaultValue: 'team-a',
    lock: 'lockedEditable'
  },
  { key: 'tier', defaultValue: 'gold', lock: 'lockedStatic' }
]

test('a free tag is added to the defaults of the required tags', () => {
  const { elements } = prepareElements([{ label: 'A', tags: { Env: 'prod' } }], required)
  assert.deepEqual(elements[0].metadata, {
    owner: { value: 'team-a', lock: 'lockedEditable' },
    tier: { value: 'gold', lock: 'lockedStatic' },
    Env: { value: 'prod' }
  })
})

test('a header names a required tag without regard to case, and keeps its lock', () => {
  const { elements, warnings } = prepareElements(
    [{ label: 'A', tags: { Owner: 'team-b' } }],
    required
  )
  assert.deepEqual(elements[0].metadata.owner, { value: 'team-b', lock: 'lockedEditable' })
  assert.deepEqual(warnings, [])
})

test('a value the required tag does not allow, or a static tag, is left at the default and counted', () => {
  const { elements, warnings } = prepareElements(
    [
      { label: 'A', tags: { owner: 'nobody', tier: 'silver' } },
      { label: 'B', tags: { owner: 'nobody2' } }
    ],
    required
  )
  assert.equal(elements[0].metadata.owner.value, 'team-a')
  assert.equal(elements[0].metadata.tier.value, 'gold')
  assert.deepEqual(warnings, [
    '2 values for "owner" not allowed there: left at the default',
    '1 value for "tier" ignored: it is a static tag'
  ])
})

test('the container is kept as a tag under its header, and notes are counted', () => {
  const { elements, noteCount } = prepareElements(
    [
      { label: 'A', container: 'Payments', note: 'n', tags: {} },
      { label: 'B', tags: {} }
    ],
    [],
    'Domain'
  )
  assert.deepEqual(elements[0].metadata, { Domain: { value: 'Payments' } })
  assert.equal(elements[0].note, 'n')
  assert.equal(elements[1].metadata, undefined)
  assert.equal(noteCount, 1)
})

// ---- the example ------------------------------------------------------------------------------

test('examples/paste-a-table.csv reads as a table and merges its repeated row', () => {
  const text = readFileSync(
    join(import.meta.dirname, '..', '..', '..', 'examples', 'paste-a-table.csv'),
    'utf-8'
  )
  const rows = parseTable(text)
  assert.ok(looksLikeTable(rows))
  const cols = guessColumns(rows[0])
  assert.deepEqual(
    cols.map((c) => c.role),
    ['label', 'note', 'container', 'tag', 'tag', 'tag']
  )
  const {
    elements,
    conflicts,
    rows: count
  } = buildElements(rows.slice(1), cols, { type: 'entity' })
  assert.equal(count, 8)
  assert.equal(elements.length, 7)
  const billing = elements.find((e) => e.label === 'Billing API')
  assert.equal(billing.note, 'Charges cards, issues invoices and sends receipts.')
  assert.deepEqual(conflicts, [
    'Notification Service: Environment is "staging" and "prod"; kept "staging"'
  ])
})
