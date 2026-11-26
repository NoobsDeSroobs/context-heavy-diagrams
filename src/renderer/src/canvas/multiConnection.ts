import { isConnectableNodeType } from './nodeFields'

// Which nodes a connection drag starts from. Dragging from a selected node wires every
// selected, connectable node to the drop target; dragging from a node that is not selected wires only
// that node, so a selection left over from an earlier move never adds edges. A selected node is never
// wired to itself: the target is left out when it is known.
export function connectionSourceIds(
  nodes: readonly { id: string; type?: string; selected?: boolean }[],
  source: string,
  target?: string
): string[] {
  const draggedFromSelection = nodes.some((n) => n.id === source && n.selected === true)
  return nodes
    .filter(
      (n) =>
        n.id === source ||
        (draggedFromSelection &&
          n.selected === true &&
          isConnectableNodeType(n.type) &&
          n.id !== target)
    )
    .map((n) => n.id)
}
