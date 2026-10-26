// An assistant that rewrites a whole diagram often invents new ids, and then every element reads as
// removed and added. This finds the pairs: which removed element is probably which added one. It is
// a guess, so the comparison only uses it when the reviewer asks, and says so where it did.

import type { DiagramEdge, DiagramFile, DiagramNode } from '../diagram'

// Elements that exist on one side only (their ids are not in the other version).
function removedAndAdded<T extends { id: string }>(
  base: T[],
  next: T[]
): { removed: T[]; added: T[] } {
  const baseIds = new Set(base.map((e) => e.id))
  const nextIds = new Set(next.map((e) => e.id))
  return {
    removed: base.filter((e) => !nextIds.has(e.id)),
    added: next.filter((e) => !baseIds.has(e.id))
  }
}

function typeOf(node: DiagramNode): string {
  return node.type ?? 'entity'
}

// The name an element is known by: its first line, lower case, spaces collapsed.
function nameOf(node: DiagramNode): string {
  return (node.data.label ?? '').split('\n')[0].toLowerCase().replace(/\s+/g, ' ').trim()
}

const exactKey = (node: DiagramNode): string => `${typeOf(node)}\u0000${nameOf(node)}`

// Enough removed elements with a same-named added twin that the ids almost certainly changed,
// rather than a few elements being renamed. Cheap: one pass with a map.
export const CHURN_MIN_TWINS = 3
const CHURN_MIN_SHARE = 0.25

export interface ChurnSuspicion {
  // Removed elements that have an added element of the same type and name.
  twins: number
  removed: number
  added: number
  // Whether the banner offering to match should show.
  suspected: boolean
}

export function detectIdChurn(base: DiagramFile, next: DiagramFile): ChurnSuspicion {
  const { removed, added } = removedAndAdded(base.nodes, next.nodes)
  const addedNames = new Set(added.filter((n) => nameOf(n) !== '').map(exactKey))
  const twins = removed.filter((n) => nameOf(n) !== '' && addedNames.has(exactKey(n))).length
  return {
    twins,
    removed: removed.length,
    added: added.length,
    suspected: twins >= CHURN_MIN_TWINS && twins >= removed.length * CHURN_MIN_SHARE
  }
}

export interface IdMatches {
  // Earlier id -> later id.
  nodes: Map<string, string>
  edges: Map<string, string>
  // True when the second pass was skipped because there were too many left to compare.
  fuzzySkipped: boolean
}

// Above this many (removed x added) pairs the similarity pass is not run: it is quadratic.
const MAX_FUZZY_PAIRS = 4_000_000
const FUZZY_THRESHOLD = 0.6

function centre(node: DiagramNode, byId: Map<string, DiagramNode>): { x: number; y: number } {
  let x = node.position.x
  let y = node.position.y
  let parent = node.parentId ? byId.get(node.parentId) : undefined
  for (let depth = 0; parent && depth < 50; depth += 1) {
    x += parent.position.x
    y += parent.position.y
    parent = parent.parentId ? byId.get(parent.parentId) : undefined
  }
  const size = node.size ?? { width: 150, height: 60 }
  return { x: x + size.width / 2, y: y + size.height / 2 }
}

function distance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

// Names longer than this are cut for comparing: a label is a name, not a document.
const MAX_NAME = 120

// Edit distance with two reused rows: this runs for every pair, so it allocates nothing.
let previousRow = new Int32Array(MAX_NAME + 1)
let currentRow = new Int32Array(MAX_NAME + 1)

function editSimilarity(a: string, b: string): number {
  const n = a.length
  const m = b.length
  for (let j = 0; j <= m; j += 1) previousRow[j] = j
  for (let i = 1; i <= n; i += 1) {
    currentRow[0] = i
    const ca = a.charCodeAt(i - 1)
    for (let j = 1; j <= m; j += 1) {
      let best = previousRow[j - 1] + (ca === b.charCodeAt(j - 1) ? 0 : 1)
      const up = previousRow[j] + 1
      if (up < best) best = up
      const left = currentRow[j - 1] + 1
      if (left < best) best = left
      currentRow[j] = best
    }
    const swap = previousRow
    previousRow = currentRow
    currentRow = swap
  }
  return 1 - previousRow[m] / Math.max(n, m)
}

// Below this, two names are not alike enough to consider.
const MIN_WORDS = 0.4
// A name that holds the other ("Passenger" in "Passenger (mobile app user)") is the most common
// kind of rename, and edit distance alone rates it low, so it counts as a strong match. Only for
// names long enough that holding one says something.
const MIN_CONTAINED = 4

// 1 for the same text, towards 0 as more has to change to turn one into the other.
function similarity(a: string, b: string): number {
  if (a === b) return 1
  if (a === '' || b === '') return 0
  const [short, long] = a.length <= b.length ? [a, b] : [b, a]
  const contained =
    short.length >= MIN_CONTAINED && long.includes(short)
      ? 0.6 + 0.4 * (short.length / long.length)
      : 0
  // Names of very different length cannot be MIN_WORDS alike, whatever their letters.
  if (short.length < MIN_WORDS * long.length) return contained
  return Math.max(contained, editSimilarity(a, b))
}

// How near two places are, 1 at the same place, falling off over a few hundred pixels.
function nearness(distanceApart: number): number {
  return 1 / (1 + distanceApart / 300)
}

// What the second pass compares, worked out once per element, not once per pair.
interface Compared {
  node: DiagramNode
  type: string
  name: string
  x: number
  y: number
}

function prepare(nodes: DiagramNode[], byId: Map<string, DiagramNode>): Compared[] {
  return nodes.map((node) => {
    const place = centre(node, byId)
    return {
      node,
      type: typeOf(node),
      name: nameOf(node).slice(0, MAX_NAME),
      x: place.x,
      y: place.y
    }
  })
}

interface Candidate {
  from: DiagramNode
  to: DiagramNode
  score: number
}

// The second pass stops after this long, so a very large diagram cannot freeze the window.
const FUZZY_BUDGET_MS = 2500

function matchNodes(
  base: DiagramFile,
  next: DiagramFile
): {
  matches: Map<string, string>
  fuzzySkipped: boolean
} {
  const baseById = new Map(base.nodes.map((n) => [n.id, n]))
  const nextById = new Map(next.nodes.map((n) => [n.id, n]))
  const { removed, added } = removedAndAdded(base.nodes, next.nodes)
  const matches = new Map<string, string>()
  const taken = new Set<string>()

  // Pass 1: the same type and name. Several of one name are told apart by place.
  const byName = new Map<string, DiagramNode[]>()
  for (const node of added) {
    if (nameOf(node) === '') continue
    const list = byName.get(exactKey(node)) ?? []
    list.push(node)
    byName.set(exactKey(node), list)
  }
  for (const from of removed) {
    const pool = (byName.get(exactKey(from)) ?? []).filter((n) => !taken.has(n.id))
    if (pool.length === 0) continue
    const here = centre(from, baseById)
    const nearest = pool.reduce((best, candidate) =>
      distance(here, centre(candidate, nextById)) < distance(here, centre(best, nextById))
        ? candidate
        : best
    )
    matches.set(from.id, nearest.id)
    taken.add(nearest.id)
  }

  // Pass 2: what is left, by how alike the names are and how near the places. Quadratic, so it
  // is skipped above a size and stopped after a time.
  const leftRemoved = prepare(
    removed.filter((n) => !matches.has(n.id) && nameOf(n) !== ''),
    baseById
  )
  const leftAdded = prepare(
    added.filter((n) => !taken.has(n.id) && nameOf(n) !== ''),
    nextById
  )
  if (leftRemoved.length * leftAdded.length > MAX_FUZZY_PAIRS) {
    return { matches, fuzzySkipped: true }
  }
  const deadline = Date.now() + FUZZY_BUDGET_MS
  let cutShort = false
  const candidates: Candidate[] = []
  for (const from of leftRemoved) {
    if (Date.now() > deadline) {
      cutShort = true
      break
    }
    for (const to of leftAdded) {
      if (from.type !== to.type) continue
      const words = similarity(from.name, to.name)
      if (words < MIN_WORDS) continue
      const score = words * 0.7 + nearness(Math.hypot(from.x - to.x, from.y - to.y)) * 0.3
      if (score >= FUZZY_THRESHOLD) candidates.push({ from: from.node, to: to.node, score })
    }
  }
  // Best pairs first, each element used once.
  candidates.sort((a, b) => b.score - a.score)
  for (const { from, to } of candidates) {
    if (matches.has(from.id) || taken.has(to.id)) continue
    matches.set(from.id, to.id)
    taken.add(to.id)
  }
  return { matches, fuzzySkipped: cutShort }
}

function endKey(edge: DiagramEdge, mapped: (id: string) => string): string {
  return `${mapped(edge.source)}\u0000${mapped(edge.target)}\u0000${edge.label ?? ''}`
}

// Which removed element is probably which added one, nodes first, then the connections between
// them (by the elements they join and their label).
export function matchReplaced(base: DiagramFile, next: DiagramFile): IdMatches {
  const { matches: nodes, fuzzySkipped } = matchNodes(base, next)
  const mapped = (id: string): string => nodes.get(id) ?? id

  const { removed, added } = removedAndAdded(base.edges, next.edges)
  const pool = new Map<string, DiagramEdge[]>()
  for (const edge of added) {
    const key = endKey(edge, (id) => id)
    const list = pool.get(key) ?? []
    list.push(edge)
    pool.set(key, list)
  }
  const edges = new Map<string, string>()
  for (const edge of removed) {
    const list = pool.get(endKey(edge, mapped))
    const twin = list?.shift()
    if (twin) edges.set(edge.id, twin.id)
  }
  return { nodes, edges, fuzzySkipped }
}

// The earlier version with the matched elements carrying the later version's ids, so a comparison
// sees them as the same element. Everything that names a node by id is rewritten with it.
export function applyIdMatches(
  base: DiagramFile,
  matches: { nodes: ReadonlyMap<string, string>; edges: ReadonlyMap<string, string> }
): DiagramFile {
  const node = (id: string): string => matches.nodes.get(id) ?? id
  const edge = (id: string): string => matches.edges.get(id) ?? id
  return {
    ...base,
    nodes: base.nodes.map((n) => ({
      ...n,
      id: node(n.id),
      ...(n.parentId === undefined ? {} : { parentId: node(n.parentId) })
    })),
    edges: base.edges.map((e) => ({
      ...e,
      id: edge(e.id),
      source: node(e.source),
      target: node(e.target),
      ...(e.directionSets
        ? {
            directionSets: Object.fromEntries(
              Object.entries(e.directionSets).map(([setId, d]) => [
                setId,
                { ...d, source: node(d.source), target: node(d.target) }
              ])
            )
          }
        : {})
    })),
    ...(base.security
      ? {
          security: {
            ...base.security,
            matrixEntityIds: base.security.matrixEntityIds.map(node),
            ...(base.security.hiddenEntityIds
              ? { hiddenEntityIds: base.security.hiddenEntityIds.map(node) }
              : {})
          }
        }
      : {})
  }
}
