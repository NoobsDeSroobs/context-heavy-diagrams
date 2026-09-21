// Run with `npm test` (Node's built-in runner; TypeScript is type-stripped).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  criteriaFromQuery,
  elementMatchesCriteria,
  hasSearchCriteria,
  matchesStructuredCriteria,
  parseSearchQuery
} from './search.ts'

const q = (raw, icon = null) => criteriaFromQuery(raw, icon)
const matches = (raw, el, icon = null) => elementMatchesCriteria(q(raw, icon), el)

const customerDb = {
  id: 'n1',
  label: 'Customer DB',
  metadata: { classification: { value: 'GDPR.PII' }, owner: { value: 'Alice' } },
  icons: { topLeft: { source: 'builtin', id: 'database' } },
  references: ['assets/references/a.png'],
  details: 'details/customer-db.md',
  linkedDiagram: 'customer/customer.chd'
}
const gdprNoPic = { ...customerDb, id: 'n2', references: [] }
const cache = { id: 'n3', label: 'Cache', references: ['assets/references/b.png'] }
const edge = { id: 'e1', label: 'GDPR link', metadata: { classification: { value: 'GDPR.PII' } } }
// A shape *named* Integration, with no integration tag — what tag: must not match.
const integrationShape = { id: 'n4', label: 'Integration gateway', details: 'details/i.md' }
const taggedIntegration = {
  id: 'n5',
  label: 'Orders sync',
  metadata: { integration: { value: 'REST' } }
}

test('parsing: a run of bare words is ONE any term (a phrase)', () => {
  assert.deepEqual(parseSearchQuery('web server').any, ['web server'])
  assert.deepEqual(parseSearchQuery('any:"web server"').any, ['web server'])
})

test('parsing: a name:value term ends the run — "customer label:x db" is three terms', () => {
  const p = parseSearchQuery('customer label:x db')
  assert.deepEqual(p.any, ['customer', 'db'])
  assert.deepEqual(p.labels, ['x'])
})

test('parsing: mixed terms', () => {
  const p = parseSearchQuery('web server has:references tag:gdpr id:n1 label:"big db"')
  assert.deepEqual(p.any, ['web server'])
  assert.deepEqual(p.has, ['references'])
  assert.deepEqual(p.tags, [{ value: 'gdpr' }])
  assert.deepEqual(p.ids, ['n1'])
  assert.deepEqual(p.labels, ['big db'])
  assert.deepEqual(p.problems, [])
})

test('parsing: names are case-insensitive, has: aliases and duplicates collapse', () => {
  assert.deepEqual(parseSearchQuery('HAS:Refs has:references has:images').has, ['references'])
  assert.deepEqual(parseSearchQuery('has:notes').has, ['details'])
  assert.deepEqual(parseSearchQuery('ANY:foo').any, ['foo'])
})

test('parsing: tag:key=value and quoted values with spaces', () => {
  assert.deepEqual(parseSearchQuery('tag:Owner=Alice').tags, [{ key: 'owner', value: 'alice' }])
  assert.deepEqual(parseSearchQuery('tag:"data class"=pii').tags, [
    { key: 'data class', value: 'pii' }
  ])
  assert.deepEqual(parseSearchQuery('"customer db"').any, ['customer db'])
})

test('parsing: an unknown word: prefix is plain text, so ordinary labels still search', () => {
  const p = parseSearchQuery('Note: http://x 10:00')
  assert.deepEqual(p.any, ['Note: http://x 10:00'])
  assert.deepEqual(p.problems, [])
})

test('parsing: empty values and a bad has: value are reported, not silently ignored', () => {
  const p = parseSearchQuery('has:banana tag: label:""')
  assert.equal(p.problems.length, 3)
  assert.match(p.problems[0], /has:banana/)
  assert.deepEqual([p.has, p.tags, p.labels], [[], [], []])
})

test('an empty criteria set matches nothing', () => {
  assert.equal(hasSearchCriteria(q('')), false)
  assert.equal(hasSearchCriteria(q('   ')), false)
  assert.equal(matches('', customerDb), false)
  assert.equal(hasSearchCriteria(q('has:banana')), false)
})

test('free text and any: search everywhere: id, label and tags', () => {
  assert.equal(matches('customer', customerDb), true) // label
  assert.equal(matches('n1', customerDb), true) // id
  assert.equal(matches('alice', customerDb), true) // tag value
  assert.equal(matches('classif', customerDb), true) // tag key
  assert.equal(matches('any:alice', customerDb), true)
  assert.equal(matches('gdpr', edge), true) // edges too
  assert.equal(matches('Customer DB', customerDb), true) // phrase
  assert.equal(matches('DB Customer', customerDb), false) // a phrase, order matters
})

test('every term must match (AND)', () => {
  assert.equal(matches('customer alice', customerDb), false) // one phrase "customer alice"
  assert.equal(matches('customer any:alice', customerDb), true) // two terms
  assert.equal(matches('customer any:bob', customerDb), false)
  assert.equal(matches('tag:gdpr tag:owner=alice', customerDb), true)
  assert.equal(matches('tag:gdpr tag:owner=bob', customerDb), false)
})

test('tag: matches only tags — a label or details file mentioning it is ignored', () => {
  assert.equal(matches('tag:integration', taggedIntegration), true)
  assert.equal(matches('tag:integration', integrationShape), false) // named Integration
  assert.equal(matches('integration', integrationShape), true) // free text still finds it
  assert.equal(matches('tag:integration', edge), false)
})

test('tag:value matches a key or a value; tag:key=value needs both on one tag', () => {
  assert.equal(matches('tag:classif', customerDb), true) // key
  assert.equal(matches('tag:alice', customerDb), true) // value
  assert.equal(matches('tag:owner=alice', customerDb), true)
  assert.equal(matches('tag:owner=gdpr', customerDb), false) // value of a different tag
  assert.equal(matches('tag:classification=pii', customerDb), true)
  assert.equal(matches('tag:owner=alice', edge), false)
})

test('label: and id: scope to just that field', () => {
  assert.equal(matches('label:customer', customerDb), true)
  assert.equal(matches('label:n1', customerDb), false) // id text is not the label
  assert.equal(matches('id:n1', customerDb), true)
  assert.equal(matches('id:customer', customerDb), false)
  assert.equal(matches('label:alice', customerDb), false) // a tag value is not the label
  assert.equal(matches('label:link', edge), true)
})

test('has: facets', () => {
  assert.equal(matches('has:references', customerDb), true)
  assert.equal(matches('has:references', gdprNoPic), false)
  assert.equal(matches('has:references', edge), false) // edges never carry references
  assert.equal(matches('has:icon', customerDb), true)
  assert.equal(matches('has:icon', cache), false)
  assert.equal(matches('has:details', customerDb), true)
  assert.equal(matches('has:details', cache), false)
  assert.equal(matches('has:link', customerDb), true)
  assert.equal(matches('has:link', cache), false)
})

test('the hasPicture & tag=GDPR.PII case', () => {
  const query = 'has:references tag:gdpr.pii'
  assert.equal(matches(query, customerDb), true)
  assert.equal(matches(query, gdprNoPic), false) // tag but no picture
  assert.equal(matches(query, cache), false) // picture but no tag
  assert.equal(matches(query, edge), false)
})

test('icon criterion is exact and combines with the terms', () => {
  const icon = { source: 'builtin', id: 'database' }
  assert.equal(matches('', customerDb, icon), true)
  assert.equal(matches('', cache, icon), false)
  assert.equal(matches('', edge, icon), false)
  assert.equal(matches('has:references', gdprNoPic, icon), false)
})

test('structured criteria exclude the any terms and are vacuously true when none is set', () => {
  // deep search relies on this: it only reads a details file for nodes that already pass these
  assert.equal(matchesStructuredCriteria(q('missing'), gdprNoPic), true)
  assert.equal(matchesStructuredCriteria(q('missing has:references'), gdprNoPic), false)
  assert.equal(matchesStructuredCriteria(q('missing label:customer'), customerDb), true)
})
