// Visibility sets (ADR 0194): named groups of nodes and edges that can be shown or hidden together.
// The diagram holds the catalogue (`DiagramFile.visibilitySets`); a node or an edge lists the sets it
// is in (`visibilitySetIds`). Which sets are shown is session state and is never stored.
export interface VisibilitySet {
  // Unique in the diagram; elements refer to it, so renaming the set touches no element. The app
  // writes whole numbers as strings ("1", "2") and shows them; another writer may use any string.
  // Not handed out again while an element still lists it.
  id: string
  // Free text, shown to the person.
  name: string
}
