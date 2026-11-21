// The editing operations on visibility sets (ADR 0194): make, rename and remove a set, and put
// elements in it or take them out. A set is named by its name, as the editor shows it (the id is
// hidden and an assistant never needs it); a name is unique ignoring case, as the editor insists.
// Part of the same pure core as operations.ts.
import type { DiagramEdge, DiagramNode } from '../diagram/index.ts'
import type { VisibilitySet } from '../visibility/schema.ts'
import { nameTaken, withSet, withoutSet } from '../visibility/visibility.ts'
import type { Model, OperationResult, Reader } from './model.ts'

type Element = DiagramNode | DiagramEdge

const setsOf = (model: Model): VisibilitySet[] => model.diagram.visibilitySets ?? []

function nameOf(reader: Reader, key: string): string {
  const name = reader.string(key).trim()
  if (name === '') reader.fail(`"${key}" must not be blank`)
  return name
}

// The set a name points at, ignoring case; the id works too, for a file that was written by a tool.
function setNamed(model: Model, reader: Reader, key = 'set'): VisibilitySet {
  const wanted = reader.string(key).trim()
  const sets = setsOf(model)
  const found =
    sets.find((s) => s.name.trim().toLowerCase() === wanted.toLowerCase()) ??
    sets.find((s) => s.id === wanted)
  if (!found) {
    reader.fail(
      sets.length === 0
        ? `there is no visibility set "${wanted}": this diagram has none (make one with add_visibility_set)`
        : `there is no visibility set "${wanted}" (the sets are ${sets.map((s) => `"${s.name}"`).join(', ')})`
    )
  }
  return found
}

// The elements an operation names: a node or an edge each, once.
function elementsNamed(model: Model, reader: Reader): Element[] {
  const raw = reader.raw('ids')
  if (!Array.isArray(raw) || raw.length === 0 || !raw.every((id) => typeof id === 'string')) {
    reader.fail('"ids" must be a list of element ids, at least one')
  }
  return [...new Set(raw as string[])].map((id) => {
    const element = model.node(id) ?? model.edge(id)
    if (!element) reader.fail(`"${id}" is not an element of this diagram`)
    return element
  })
}

const membersOf = (model: Model, set: VisibilitySet): string[] =>
  [...model.nodes, ...model.edges]
    .filter((el) => el.visibilitySetIds?.includes(set.id))
    .map((el) => el.id)

function store(element: Element, ids: string[] | undefined): void {
  if (ids) element.visibilitySetIds = ids
  else delete element.visibilitySetIds
}

function addVisibilitySet(model: Model, reader: Reader): OperationResult {
  const name = nameOf(reader, 'name')
  if (nameTaken(setsOf(model), name)) {
    reader.fail(
      `there is already a visibility set named "${name}" (names are unique, ignoring case)`
    )
  }
  const listed = new Set(
    [...model.nodes, ...model.edges].flatMap((el) => el.visibilitySetIds ?? [])
  )
  let id: string | undefined
  for (let attempt = 0; attempt < 5 && id === undefined; attempt += 1) {
    const candidate = model.options.newId('vis')
    if (!setsOf(model).some((s) => s.id === candidate) && !listed.has(candidate)) id = candidate
  }
  if (id === undefined) reader.fail('could not make a unique id')
  const set = { id, name }
  model.diagram.visibilitySets = [...setsOf(model), set]
  return { op: 'add_visibility_set', visibilitySet: set, members: [] }
}

function renameVisibilitySet(model: Model, reader: Reader): OperationResult {
  const current = setNamed(model, reader)
  const name = nameOf(reader, 'name')
  if (nameTaken(setsOf(model), name, current.id)) {
    reader.fail(
      `there is already a visibility set named "${name}" (names are unique, ignoring case)`
    )
  }
  const renamed = { id: current.id, name }
  model.diagram.visibilitySets = setsOf(model).map((s) => (s.id === current.id ? renamed : s))
  return {
    op: 'rename_visibility_set',
    visibilitySet: renamed,
    members: membersOf(model, current)
  }
}

// Takes the set out of the catalogue and its id off every element that was in it; the elements stay.
function removeVisibilitySet(model: Model, reader: Reader): OperationResult {
  const current = setNamed(model, reader)
  for (const el of [...model.nodes, ...model.edges]) {
    if (el.visibilitySetIds?.includes(current.id))
      store(el, withoutSet(el.visibilitySetIds, current.id))
  }
  const rest = setsOf(model).filter((s) => s.id !== current.id)
  if (rest.length > 0) model.diagram.visibilitySets = rest
  else delete model.diagram.visibilitySets
  return { op: 'remove_visibility_set', removed: [current.id], visibilitySet: current }
}

function addToVisibilitySet(model: Model, reader: Reader): OperationResult {
  const set = setNamed(model, reader)
  for (const el of elementsNamed(model, reader)) store(el, withSet(el.visibilitySetIds, set.id))
  return { op: 'add_to_visibility_set', visibilitySet: set, members: membersOf(model, set) }
}

function removeFromVisibilitySet(model: Model, reader: Reader): OperationResult {
  const set = setNamed(model, reader)
  for (const el of elementsNamed(model, reader)) {
    if (!el.visibilitySetIds?.includes(set.id)) {
      reader.fail(`"${el.id}" is not in the visibility set "${set.name}"`)
    }
    store(el, withoutSet(el.visibilitySetIds, set.id))
  }
  return {
    op: 'remove_from_visibility_set',
    visibilitySet: set,
    members: membersOf(model, set)
  }
}

export const VISIBILITY_OPERATIONS: Record<
  string,
  (model: Model, reader: Reader) => OperationResult
> = {
  add_visibility_set: addVisibilitySet,
  rename_visibility_set: renameVisibilitySet,
  remove_visibility_set: removeVisibilitySet,
  add_to_visibility_set: addToVisibilitySet,
  remove_from_visibility_set: removeFromVisibilitySet
}
