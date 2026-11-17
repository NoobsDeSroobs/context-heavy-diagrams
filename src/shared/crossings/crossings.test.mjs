import test from 'node:test'
import assert from 'node:assert/strict'
import { ancestorsOf, crossingText, edgeCrossing, gatesOnPath } from './crossings.ts'

// Sales holds Billing; Warehouse and Finance are apart. `a` and `b` are in Sales, `bill` in Billing,
// `pick` in Warehouse, `erp` is outside every container.
const parents = {
  Billing: 'Sales',
  a: 'Sales',
  b: 'Sales',
  bill: 'Billing',
  pick: 'Warehouse',
  pay: 'Finance'
}
const parentOf = (id) => parents[id]
const nameOf = (id) => id

test('the containers around an element, nearest first, and a loop does not run on', () => {
  assert.deepEqual(ancestorsOf('bill', parentOf), ['Billing', 'Sales'])
  assert.deepEqual(ancestorsOf('erp', parentOf), [])
  assert.deepEqual(
    ancestorsOf('x', (id) => (id === 'x' ? 'y' : 'x')),
    ['y']
  )
})

test('an edge inside one container, or outside all of them, crosses nothing', () => {
  assert.equal(edgeCrossing('a', 'b', parentOf), null)
  assert.equal(edgeCrossing('erp', 'erp2', parentOf), null)
  assert.equal(edgeCrossing('a', 'a', parentOf), null)
})

test('an edge between two lanes leaves one border and enters one', () => {
  assert.deepEqual(edgeCrossing('a', 'pick', parentOf), {
    leaving: ['Sales'],
    entering: ['Warehouse']
  })
})

test('an edge from outside into a container enters one border', () => {
  assert.deepEqual(edgeCrossing('erp', 'a', parentOf), { leaving: [], entering: ['Sales'] })
  assert.deepEqual(edgeCrossing('pick', 'erp', parentOf), { leaving: ['Warehouse'], entering: [] })
})

test('nested containers count one border each', () => {
  // Out of Billing into the Sales that holds it: one border.
  assert.deepEqual(edgeCrossing('bill', 'a', parentOf), { leaving: ['Billing'], entering: [] })
  // Out of Billing and Sales, into Finance: three.
  assert.deepEqual(edgeCrossing('bill', 'pay', parentOf), {
    leaving: ['Billing', 'Sales'],
    entering: ['Finance']
  })
  assert.deepEqual(edgeCrossing('pay', 'bill', parentOf), {
    leaving: ['Finance'],
    entering: ['Sales', 'Billing']
  })
})

test('an edge between a container and what is in it crosses nothing', () => {
  assert.equal(edgeCrossing('Sales', 'a', parentOf), null)
  assert.equal(edgeCrossing('bill', 'Sales', parentOf), null)
})

test('the route reads out of the source and into the target by name', () => {
  assert.equal(crossingText(edgeCrossing('a', 'pick', parentOf), nameOf), 'Sales → Warehouse')
  assert.equal(
    crossingText(edgeCrossing('bill', 'pay', parentOf), nameOf),
    'Billing › Sales → Finance'
  )
  assert.equal(crossingText(edgeCrossing('erp', 'a', parentOf), nameOf), 'outside → Sales')
})

const lane = { id: 'L', rect: { x: 0, y: 0, width: 300, height: 100 } }

test('a gate lies along the border it goes through, however the edge slants', () => {
  // Straight down through the bottom border: a horizontal bar.
  const down = gatesOnPath(
    [
      { x: 100, y: 50 },
      { x: 100, y: 150 }
    ],
    [lane]
  )
  assert.deepEqual(
    down.map((g) => [g.x, g.y, g.axis]),
    [[100, 100, 'horizontal']]
  )
  // Slanting down through the bottom border: still horizontal.
  const slant = gatesOnPath(
    [
      { x: 100, y: 50 },
      { x: 160, y: 150 }
    ],
    [lane]
  )
  assert.equal(slant[0].axis, 'horizontal')
  assert.ok(Math.abs(slant[0].x - 130) < 1e-9)
  // Out through the right border: a vertical bar.
  const out = gatesOnPath(
    [
      { x: 250, y: 40 },
      { x: 400, y: 60 }
    ],
    [lane]
  )
  assert.deepEqual(
    out.map((g) => [g.y.toFixed(0), g.axis]),
    [['47', 'vertical']]
  )
})

test('a path that stays inside, or never reaches the container, has no gate', () => {
  const inside = [
    { x: 10, y: 10 },
    { x: 200, y: 80 }
  ]
  const away = [
    { x: 400, y: 10 },
    { x: 500, y: 80 }
  ]
  assert.deepEqual(gatesOnPath(inside, [lane]), [])
  assert.deepEqual(gatesOnPath(away, [lane]), [])
})

test('an edge out of two nested containers has a gate on each border', () => {
  const inner = { id: 'inner', rect: { x: 20, y: 20, width: 100, height: 60 } }
  const outer = { id: 'outer', rect: { x: 0, y: 0, width: 300, height: 200 } }
  const gates = gatesOnPath(
    [
      { x: 60, y: 50 },
      { x: 60, y: 300 }
    ],
    [inner, outer]
  )
  assert.deepEqual(
    gates.map((g) => g.containerId),
    ['inner', 'outer']
  )
  assert.ok(gates.every((g) => g.axis === 'horizontal'))
})

test('a crossing exactly on a corner is one gate', () => {
  const gates = gatesOnPath(
    [
      { x: -50, y: -50 },
      { x: 50, y: 50 }
    ],
    [lane]
  )
  assert.equal(gates.length, 1)
})
