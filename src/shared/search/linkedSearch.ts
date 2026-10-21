// Deep search across linked diagrams (ADR 0097): the pure tree walk. For each
// link the open diagram carries, it follows `linkedDiagram` links depth-first
// through diagrams that aren't open and answers one question: does anything in
// that subtree match? The answer lands on the *linking node* in the open
// diagram, which is what gets highlighted. All I/O and the match predicates are
// injected so this has no runtime imports and can be unit-tested with plain
// node:test (`npm test`); src/main/search/linkedSearch.ts wires in the real filesystem
// and the shared predicate.
import type { DiagramFile, DiagramEdge, DiagramNode } from '../diagram'

export interface LinkedSearchLink {
  // The open diagram's node that carries the link.
  nodeId: string
  relativePath: string
}

export interface LinkedSearchResult {
  // The links (by node id) whose subtree contains a match.
  matchedNodeIds: string[]
  // Absolute paths of linked diagrams that couldn't be read — reported, never
  // silently treated as "no match".
  unreadable: string[]
}

export interface LinkedSearchDeps {
  // Absolute path of a link stored in the diagram at `fromPath`.
  resolve(fromPath: string, relativePath: string): string
  // Identity of an absolute path for the visited set (case-folded on Windows).
  keyOf(absolutePath: string): string
  // Throws when the file is missing or unreadable.
  load(absolutePath: string): Promise<DiagramFile>
  // Cheap, in-memory tiers first: the walk checks every node and edge with these
  // before it spends a file read on anything.
  matchNode(node: DiagramNode): boolean
  matchEdge(edge: DiagramEdge): boolean
  // Costlier tier: does the node's details note match? `diagramPath` is the
  // diagram the node lives in — its notes resolve relative to that.
  matchNodeNote(node: DiagramNode, diagramPath: string): Promise<boolean>
}

export async function searchLinkedDiagrams(
  rootPath: string,
  links: LinkedSearchLink[],
  deps: LinkedSearchDeps
): Promise<LinkedSearchResult> {
  const unreadable = new Set<string>()

  // Whether anything reachable from `path` (itself included) matches. `visited`
  // is per link: each diagram is examined once per subtree, cycles and
  // diamonds can't loop or repeat, and the open diagram is pre-visited so a
  // link back up is skipped (its own contents are the open diagram's search).
  async function subtreeMatches(path: string, visited: Set<string>): Promise<boolean> {
    let file: DiagramFile
    try {
      file = await deps.load(path)
    } catch {
      unreadable.add(path)
      return false
    }
    // Cheapest first: this diagram's in-memory fields, then its notes, then the
    // diagrams it links to (each a further file read — or, one day, a fetch).
    if (file.nodes.some(deps.matchNode) || file.edges.some(deps.matchEdge)) return true
    const noteHits = await Promise.all(file.nodes.map((node) => deps.matchNodeNote(node, path)))
    if (noteHits.some(Boolean)) return true
    for (const node of file.nodes) {
      const link = node.data?.linkedDiagram
      if (typeof link !== 'string' || link.trim() === '') continue
      const child = deps.resolve(path, link)
      const key = deps.keyOf(child)
      if (visited.has(key)) continue
      visited.add(key)
      if (await subtreeMatches(child, visited)) return true
    }
    return false
  }

  const matchedNodeIds: string[] = []
  for (const link of links) {
    const path = deps.resolve(rootPath, link.relativePath)
    const visited = new Set([deps.keyOf(rootPath), deps.keyOf(path)])
    if (await subtreeMatches(path, visited)) matchedNodeIds.push(link.nodeId)
  }
  return { matchedNodeIds, unreadable: [...unreadable] }
}
