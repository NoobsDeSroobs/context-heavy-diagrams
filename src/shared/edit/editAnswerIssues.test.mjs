// What an edit answers about the layout: the problems that involve what it touched, and a count of the
// rest (ADR 0171).
import assert from 'node:assert/strict'
import test from 'node:test'
import { createEmptyDiagram } from '../diagram/index.ts'
import { editAnswerIssues } from './answers.ts'
import { applyOperations } from './operations.ts'

let counter = 0
const run = (diagram, operations) =>
  applyOperations(diagram, operations, { newId: (prefix) => `${prefix}-${(counter += 1)}` })

// a and b overlap; c and d overlap; far is clear of everything.
const start = run(createEmptyDiagram(), [
  { op: 'add_entity', id: 'a', label: 'A', x: 0, y: 0 },
  { op: 'add_entity', id: 'b', label: 'B', x: 40, y: 20 },
  { op: 'add_entity', id: 'c', label: 'C', x: 600, y: 0 },
  { op: 'add_entity', id: 'd', label: 'D', x: 640, y: 20 }
]).diagram

test('a call that touches the problem sees it, and the other problem is only counted', () => {
  const { diagram, results } = run(start, [{ op: 'move', id: 'a', x: 10, y: 0 }])
  const lines = editAnswerIssues(diagram, results)
  assert.equal(lines.length, 2)
  assert.match(lines[0], /\(a\) and "B" \(b\) overlap/)
  assert.match(lines[1], /^1 other problem elsewhere in the diagram was left out/)
  assert.match(lines[1], /issues_only/)
})

test('a call that touches no problem gets only the count', () => {
  const { diagram, results } = run(start, [
    { op: 'add_entity', id: 'far', label: 'Far', x: 0, y: 900 }
  ])
  const lines = editAnswerIssues(diagram, results)
  assert.equal(lines.length, 1)
  assert.match(lines[0], /^2 other problems elsewhere in the diagram were left out/)
})

test('a clean diagram answers with no problems at all', () => {
  const { diagram, results } = run(createEmptyDiagram(), [
    { op: 'add_entity', id: 'a', label: 'A', x: 0, y: 0 }
  ])
  assert.deepEqual(editAnswerIssues(diagram, results), [])
})

test('moving a container counts what is inside it as touched', () => {
  const built = run(createEmptyDiagram(), [
    { op: 'add_container', id: 'zone', label: 'Zone', x: 0, y: 0, width: 300, height: 300 },
    { op: 'add_entity', id: 'in', label: 'In', x: 20, y: 60, parent: 'zone' },
    { op: 'add_entity', id: 'other', label: 'Other', x: 600, y: 60 }
  ]).diagram
  // Moves the container (and so "in") on top of "other".
  const { diagram, results } = run(built, [{ op: 'move', id: 'zone', x: 580, y: 0 }])
  const lines = editAnswerIssues(diagram, results)
  assert.ok(
    lines.some((line) => /overlap/.test(line)),
    lines.join('\n')
  )
})

test('the count is of problems, not of lines', () => {
  const crowded = run(createEmptyDiagram(), [
    ...Array.from({ length: 6 }, (_, i) => ({
      op: 'add_entity',
      id: `n${i}`,
      label: `N${i}`,
      x: i * 20,
      y: 0
    }))
  ]).diagram
  const { diagram, results } = run(crowded, [
    { op: 'add_entity', id: 'free', label: 'Free', x: 0, y: 900 }
  ])
  // Six boxes 20px apart: every neighbour pair and more overlap, all grouped into few lines but
  // counted one by one.
  const [line] = editAnswerIssues(diagram, results)
  assert.match(line, /^\d{2,} other problems elsewhere/)
})
