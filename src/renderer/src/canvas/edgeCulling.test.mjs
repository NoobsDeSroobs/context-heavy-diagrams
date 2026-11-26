import test from 'node:test'
import assert from 'node:assert/strict'
import { waypointEdgeHidden } from './edgeCulling.ts'

// An edge from a box at the far left to one at the right, dipping to y 650 through a waypoint, as
// in examples/life-parallel-selectors.chd.
const dipping = {
  ends: [
    { x: -1677, y: 61, x2: -1527, y2: 117 },
    { x: 190, y: 176, x2: 238, y2: 224 }
  ],
  points: [{ x: -636, y: 649 }]
}

test('an edge whose ends are in view is left to React Flow', () => {
  assert.equal(waypointEdgeHidden([dipping], { x: 100, y: 0, x2: 400, y2: 300 }), false)
})

test('an edge that dips into a window its ends do not reach would be dropped', () => {
  assert.equal(waypointEdgeHidden([dipping], { x: -900, y: 400, x2: -300, y2: 800 }), true)
})

test('two waypoints with a high gravity send the curve far past them', () => {
  const swinging = {
    ends: [
      { x: 0, y: 0, x2: 100, y2: 50 },
      { x: 1000, y: 0, x2: 1100, y2: 50 }
    ],
    points: [
      { x: 400, y: 600, gravity: 3 },
      { x: 700, y: 600, gravity: 3 }
    ]
  }
  // Beyond the waypoints by more than the fixed 100, still within what the gravity allows.
  const view = { x: 300, y: 1000, x2: 800, y2: 1400 }
  assert.equal(waypointEdgeHidden([swinging], view), true)
  const tame = { ...swinging, points: swinging.points.map((p) => ({ ...p, gravity: 0.5 })) }
  assert.equal(waypointEdgeHidden([tame], view), false)
})

test('a window clear of the edge and its waypoints needs nothing', () => {
  assert.equal(waypointEdgeHidden([dipping], { x: 400, y: 1300, x2: 900, y2: 1700 }), false)
  assert.equal(waypointEdgeHidden([], { x: 0, y: 0, x2: 10, y2: 10 }), false)
})
