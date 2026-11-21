// Visibility sets (ADR 0194): named groups of nodes and edges that can be shown or hidden together.
// The diagram holds the catalogue (`DiagramFile.visibilitySets`); a node or an edge lists the sets it
// is in (`visibilitySetIds`). Which sets are shown is session state and is never stored.
export interface VisibilitySet {
  // Opaque and unique in the diagram; elements refer to it, so renaming the set touches no element.
  // A person never sees it: the name is shown.
  id: string
  // Free text, shown to the person.
  name: string
}

// A story (ADR 0195): an ordered list of steps over the visibility sets, told in the presenter view.
// The diagram holds them (`DiagramFile.stories`). The step being shown is session state and is
// never stored.
export interface Story {
  // Opaque and unique among the diagram's stories; a person sees the name.
  id: string
  // Free text, shown to the person.
  name: string
  steps: StoryStep[]
}

// What one step does to the sets, on top of the state the earlier steps left. Both lists hold set
// ids. The sets in `hide` are hidden first, then the sets in `show` are shown, so a set in both ends
// shown. Both are left out of the file when empty; a step that changes nothing is `{}`.
export interface StoryStep {
  show?: string[]
  hide?: string[]
}
