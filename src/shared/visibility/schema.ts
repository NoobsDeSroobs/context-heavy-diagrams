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
  // The start state: actions that run first, on top of every set hidden, when the story begins. Left
  // out when it has none.
  start?: StoryStep
  steps: StoryStep[]
}

// What one step does, as an ordered list of actions applied on top of the state the earlier steps
// left. A step that does nothing is `{}`: `actions` is left out of the file when empty.
export interface StoryStep {
  actions?: StoryAction[]
}

// One action of a step. `action` says what to do and the other fields say to what: `show` and `hide`
// name a visibility set by id. A reader ignores an action it does not know, so a later version can add
// actions (and their own fields) without breaking an older one; the fields it does not know are kept.
export interface StoryAction {
  action: string
  // The visibility set the action is about; present for every action that is about one.
  set?: string
  [other: string]: unknown
}
