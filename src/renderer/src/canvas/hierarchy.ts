import type { Node } from '@xyflow/react'
import { absolutePosition, subtractPosition } from '../nodes/nodePosition'

export function sortNodesForHierarchy(nodes: Node[]): Node[] {
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const placed = new Set<string>()
  const visiting = new Set<string>()
  const result: Node[] = []
  const visit = (node: Node): void => {
    if (placed.has(node.id) || visiting.has(node.id)) return
    visiting.add(node.id)
    const parent = node.parentId ? byId.get(node.parentId) : undefined
    if (parent) visit(parent)
    visiting.delete(node.id)
    placed.add(node.id)
    result.push(node)
  }
  nodes.forEach(visit)
  return result
}

// Load-time repair of a corrupt container hierarchy (ADR 0075). Runs once per
// load, before the nodes reach React Flow — an in-session edit can't produce
// either of these states (every parentId write is guarded). Silent, but each
// class of repair returns a note for the Diagnostics panel. `.chd` unchanged;
// the file self-heals on the next save.
//  - dangling parentId (points at a node not in the file): dropped. The
//    position numbers are kept and reinterpreted as absolute — the real
//    parent is gone, nothing better is recoverable.
//  - parent cycle: the link at the cycle's entry node is cut.
export function healHierarchy(nodes: Node[]): { nodes: Node[]; notes: string[] } {
  const stripParentId = (n: Node): Node => {
    const copy = { ...n }
    delete copy.parentId
    return copy
  }
  const ids = new Set(nodes.map((n) => n.id))
  let danglingCount = 0
  let healed = nodes.map((n) => {
    if (n.parentId && !ids.has(n.parentId)) {
      danglingCount += 1
      return stripParentId(n)
    }
    return n
  })

  let cycleCount = 0
  for (;;) {
    const byId = new Map(healed.map((n) => [n.id, n]))
    let entry: string | null = null
    for (const n of healed) {
      const seen = new Set<string>()
      let cur: string | undefined = n.id
      while (cur) {
        if (seen.has(cur)) {
          entry = cur
          break
        }
        seen.add(cur)
        cur = byId.get(cur)?.parentId
      }
      if (entry) break
    }
    if (!entry) break
    healed = healed.map((n) => (n.id === entry ? stripParentId(n) : n))
    cycleCount += 1
  }

  const notes: string[] = []
  if (danglingCount > 0) {
    notes.push(
      `Removed ${danglingCount} node reference${danglingCount === 1 ? '' : 's'} to a container that isn't in this file.`
    )
  }
  if (cycleCount > 0) {
    notes.push(
      `Broke ${cycleCount} circular container nesting relationship${cycleCount === 1 ? '' : 's'}.`
    )
  }
  return { nodes: healed, notes }
}

// Deleting a container promotes its children to the container's own parent
// (or top-level) rather than deleting them too — see ADR 0012.
export function removeContainerReparenting(nodes: Node[], containerId: string): Node[] {
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const container = byId.get(containerId)
  if (!container) return nodes
  const newParentId = container.parentId
  const newParentAbs = newParentId ? absolutePosition(byId.get(newParentId)!, byId) : undefined
  const updated = nodes
    .filter((n) => n.id !== containerId)
    .map((n) => {
      if (n.parentId !== containerId) return n
      const abs = absolutePosition(n, byId)
      const position = newParentAbs ? subtractPosition(abs, newParentAbs) : abs
      return { ...n, parentId: newParentId, position }
    })
  return sortNodesForHierarchy(updated)
}
