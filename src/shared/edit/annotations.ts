// The editing operations that describe an element rather than draw it: tags, the diagram's required
// tags, highlights, the legend, a link to another diagram, a note. Each follows what the editor does
// with the same thing (ADR 0022 for tags, 0025 and 0026 for highlights, 0033 for the legend), and
// the tag reconciliation is the editor's own code (tagging/metadataSync.ts), so a file made here
// opens in the app exactly as it was written. Part of the same pure core as operations.ts.
import type {
  DiagramEdge,
  DiagramNode,
  HighlightDefinition,
  JsonValue,
  LegendEntry,
  MetadataEntry,
  RequiredTagDefinition
} from '../diagram/index.ts'
import { highlightId } from '../tagging/highlights.ts'
import { seedMetadata, syncElementMetadata } from '../tagging/metadataSync.ts'
import {
  EDGE_STYLE,
  ID_PATTERN,
  checkedStyle,
  isRecord,
  summarizeEdge,
  summarizeNode,
  type Model,
  type OperationResult,
  type Reader,
  type StyleRule
} from './model.ts'

type Tagged = DiagramNode | DiagramEdge

const MAX_KEY_LENGTH = 100
const MAX_NOTE_CHARS = 200_000

const isEdge = (target: Tagged): target is DiagramEdge => 'source' in target

// Text and line elements carry no tags, links or notes; an entity with no type is an entity.
const carriesTags = (target: Tagged): boolean =>
  isEdge(target) || (target.type !== 'text' && target.type !== 'line')

function summaryOf(model: Model, target: Tagged): OperationResult['element'] {
  return isEdge(target) ? summarizeEdge(target) : summarizeNode(model.diagram, target)
}

function isJson(value: unknown, depth: number): boolean {
  if (depth > 20) return false
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true
  if (typeof value === 'number') return Number.isFinite(value)
  if (Array.isArray(value)) return value.every((v) => isJson(v, depth + 1))
  if (isRecord(value)) return Object.values(value).every((v) => isJson(v, depth + 1))
  return false
}

function jsonValue(reader: Reader, key: string): JsonValue {
  if (!reader.has(key)) reader.fail(`"${key}" is required (any JSON value; null for none)`)
  const value = reader.raw(key)
  if (!isJson(value, 0)) reader.fail(`"${key}" must be a JSON value`)
  return value as JsonValue
}

function tagKey(reader: Reader, key: string, given?: string): string {
  const value = given ?? reader.string(key)
  if (value.trim() === '' || value.length > MAX_KEY_LENGTH) {
    reader.fail(`"${key}" must be a name of 1 to ${MAX_KEY_LENGTH} characters`)
  }
  return value
}

function nonBlank(reader: Reader, key: string): string {
  const value = reader.string(key)
  if (value.trim() === '') reader.fail(`"${key}" must not be empty`)
  return value
}

function tagValues(metadata: Record<string, MetadataEntry> | undefined): Record<string, JsonValue> {
  const out: Record<string, JsonValue> = {}
  for (const [key, entry] of Object.entries(metadata ?? {})) out[key] = entry.value
  return out
}

function taggable(model: Model, reader: Reader): Tagged {
  const id = reader.string('id')
  const found = model.node(id) ?? model.edge(id)
  if (!found) reader.fail(`"${id}" is not an element of this diagram`)
  if (!carriesTags(found)) {
    reader.fail(
      `"${id}" is a ${(found as DiagramNode).type}; only entities, containers and edges carry tags`
    )
  }
  return found
}

function writeTag(
  model: Model,
  reader: Reader,
  target: Tagged,
  key: string,
  value: JsonValue
): void {
  const def = (model.diagram.requiredTags ?? []).find((d) => d.key === key)
  const existing = target.metadata?.[key]
  const lock = existing?.lock ?? def?.lock
  if (lock === 'lockedStatic') {
    reader.fail(
      `"${key}" is a fixed required tag: its value is set by the diagram and cannot change`
    )
  }
  if (
    lock === 'lockedEditable' &&
    def?.allowedValues &&
    value !== null &&
    !(typeof value === 'string' && def.allowedValues.includes(value))
  ) {
    reader.fail(
      `"${key}" allows only ${def.allowedValues.map((v) => `"${v}"`).join(', ')} (or null)`
    )
  }
  target.metadata = { ...target.metadata, [key]: lock ? { value, lock } : { value } }
}

// A new entity, container or edge starts with every required tag at its default, as in the editor,
// then takes the tags given with it ({ "tags": { "owner": "platform" } }).
export function startingTags(model: Model, reader: Reader, target: Tagged): void {
  const given = reader.raw('tags')
  if (!carriesTags(target)) {
    if (given !== undefined) reader.fail('a text element carries no tags')
    return
  }
  const seeded = seedMetadata(model.diagram.requiredTags ?? [])
  if (seeded) target.metadata = seeded
  if (given === undefined) return
  if (!isRecord(given)) reader.fail('"tags" must be an object of tag name to value')
  for (const [key, value] of Object.entries(given)) {
    tagKey(reader, 'tags', key)
    if (!isJson(value, 0)) reader.fail(`tag "${key}" must be a JSON value`)
    writeTag(model, reader, target, key, value as JsonValue)
  }
}

function setTag(model: Model, reader: Reader): OperationResult {
  const target = taggable(model, reader)
  const key = tagKey(reader, 'key')
  writeTag(model, reader, target, key, jsonValue(reader, 'value'))
  return { op: 'set_tag', element: summaryOf(model, target), tags: tagValues(target.metadata) }
}

function removeTag(model: Model, reader: Reader): OperationResult {
  const target = taggable(model, reader)
  const key = tagKey(reader, 'key')
  const existing = target.metadata?.[key]
  if (!existing) reader.fail(`"${target.id}" has no tag "${key}"`)
  if (existing.lock) {
    reader.fail(
      `"${key}" is a required tag, so every element carries it: change its value with set_tag, or drop it from the diagram with remove_required_tag`
    )
  }
  const next = { ...target.metadata }
  delete next[key]
  if (Object.keys(next).length > 0) target.metadata = next
  else delete target.metadata
  return { op: 'remove_tag', element: summaryOf(model, target), tags: tagValues(target.metadata) }
}

function setDiagramTag(model: Model, reader: Reader): OperationResult {
  const key = tagKey(reader, 'key')
  model.diagram.metadata = { ...model.diagram.metadata, [key]: jsonValue(reader, 'value') }
  return { op: 'set_diagram_tag', tags: { ...model.diagram.metadata } }
}

function removeDiagramTag(model: Model, reader: Reader): OperationResult {
  const key = tagKey(reader, 'key')
  if (!model.diagram.metadata || !(key in model.diagram.metadata)) {
    reader.fail(`the diagram has no tag "${key}"`)
  }
  const next = { ...model.diagram.metadata }
  delete next[key]
  if (Object.keys(next).length > 0) model.diagram.metadata = next
  else delete model.diagram.metadata
  return { op: 'remove_diagram_tag', tags: { ...model.diagram.metadata } }
}

// --- required tags: the template every entity, container and edge must carry

// Brings every element in line with the template, as the editor does when the template changes.
function reconcileElements(model: Model): string[] {
  const notices: string[] = []
  const template = model.diagram.requiredTags ?? []
  const apply = (target: Tagged, label: string): void => {
    const metadata = syncElementMetadata(target.metadata, template, label, notices)
    if (metadata) target.metadata = metadata
    else delete target.metadata
  }
  for (const node of model.nodes) {
    if (!carriesTags(node)) continue
    apply(
      node,
      `${node.type === 'container' ? 'Container' : 'Entity'} "${node.data.label || node.id}"`
    )
  }
  for (const edge of model.edges) apply(edge, `Edge "${edge.label || edge.id}"`)
  return notices
}

function setRequiredTag(model: Model, reader: Reader): OperationResult {
  const key = tagKey(reader, 'key')
  const lock = reader.optionalString('lock') ?? 'lockedEditable'
  if (lock !== 'lockedEditable' && lock !== 'lockedStatic') {
    reader.fail(
      '"lock" must be "lockedEditable" (the value can be changed) or "lockedStatic" (it cannot)'
    )
  }
  let allowedValues: string[] | undefined
  if (reader.has('allowedValues')) {
    const raw = reader.raw('allowedValues')
    if (
      !Array.isArray(raw) ||
      raw.length === 0 ||
      raw.some((v) => typeof v !== 'string' || v === '') ||
      new Set(raw).size !== raw.length
    ) {
      reader.fail('"allowedValues" must be a list of distinct, non-empty texts')
    }
    allowedValues = raw as string[]
  }
  const defaultValue = reader.has('defaultValue') ? jsonValue(reader, 'defaultValue') : undefined
  if (
    allowedValues &&
    defaultValue !== undefined &&
    defaultValue !== null &&
    !(typeof defaultValue === 'string' && allowedValues.includes(defaultValue))
  ) {
    reader.fail('"defaultValue" must be one of "allowedValues", or null')
  }
  const definition: RequiredTagDefinition = {
    key,
    ...(allowedValues ? { allowedValues } : {}),
    ...(defaultValue !== undefined ? { defaultValue } : {}),
    lock
  }
  const list = [...(model.diagram.requiredTags ?? [])]
  const at = list.findIndex((d) => d.key === key)
  if (at >= 0) list[at] = definition
  else list.push(definition)
  model.diagram.requiredTags = list
  return { op: 'set_required_tag', requiredTag: definition, notices: reconcileElements(model) }
}

function removeRequiredTag(model: Model, reader: Reader): OperationResult {
  const key = tagKey(reader, 'key')
  const list = model.diagram.requiredTags ?? []
  if (!list.some((d) => d.key === key))
    reader.fail(`"${key}" is not a required tag of this diagram`)
  const next = list.filter((d) => d.key !== key)
  if (next.length > 0) model.diagram.requiredTags = next
  else delete model.diagram.requiredTags
  // Elements keep their value under that key, as a free tag.
  return { op: 'remove_required_tag', removed: [key], notices: reconcileElements(model) }
}

// --- highlights

function setHighlight(model: Model, reader: Reader): OperationResult {
  const key = tagKey(reader, 'key')
  const value = jsonValue(reader, 'value')
  const color = nonBlank(reader, 'color')
  const definition: HighlightDefinition = { key, value, color }
  const list = [...(model.diagram.highlights ?? [])]
  const at = list.findIndex((h) => highlightId(h) === highlightId(definition))
  if (at >= 0) list[at] = definition
  else list.push(definition)
  model.diagram.highlights = list
  return { op: 'set_highlight', highlight: definition }
}

function removeHighlight(model: Model, reader: Reader): OperationResult {
  const key = tagKey(reader, 'key')
  const value = jsonValue(reader, 'value')
  const id = highlightId({ key, value })
  const list = model.diagram.highlights ?? []
  if (!list.some((h) => highlightId(h) === id)) {
    reader.fail(`there is no highlight for ${key} = ${JSON.stringify(value)}`)
  }
  const next = list.filter((h) => highlightId(h) !== id)
  if (next.length > 0) model.diagram.highlights = next
  else delete model.diagram.highlights
  return { op: 'remove_highlight', removed: [id] }
}

// --- legend

const LEGEND_LINE_FIELDS: Record<string, StyleRule> = Object.fromEntries(
  [
    'lineStyle',
    'startMarker',
    'endMarker',
    'animation',
    'animationSpeed',
    'animationDirection',
    'pulseDistance',
    'dashLength',
    'dashGap'
  ].map((name) => [name, EDGE_STYLE[name]])
)
const LEGEND_FIELDS: Record<string, StyleRule> = {
  color: { kind: 'string' },
  ...LEGEND_LINE_FIELDS
}
// The order the file writes an entry's fields in.
const LEGEND_ORDER = ['id', 'kind', 'label', ...Object.keys(LEGEND_FIELDS)]

function orderedLegend(entry: Record<string, unknown>): LegendEntry {
  const out: Record<string, unknown> = {}
  for (const key of LEGEND_ORDER) if (entry[key] !== undefined) out[key] = entry[key]
  return out as unknown as LegendEntry
}

function legendOf(model: Model, reader: Reader): LegendEntry {
  const id = reader.string('id')
  const found = (model.diagram.legend ?? []).find((e) => e.id === id)
  if (!found) reader.fail(`"${id}" is not a legend entry (the entries are ${legendIds(model)})`)
  return found
}

function legendIds(model: Model): string {
  const ids = (model.diagram.legend ?? []).map((e) => e.id)
  return ids.length > 0 ? ids.join(', ') : 'none yet'
}

function checkLegendFields(reader: Reader, kind: string, fields: Record<string, unknown>): void {
  if (kind === 'entity') {
    const line = Object.keys(fields).filter((k) => k !== 'color' && fields[k] !== null)
    if (line.length > 0) {
      reader.fail(`${line.join(', ')} only apply to a legend entry of kind "line"`)
    }
  }
}

function addLegendEntry(model: Model, reader: Reader): OperationResult {
  const kind = reader.string('kind')
  if (kind === 'icon') reader.fail('legend entries with an icon are not supported by this tool yet')
  if (kind !== 'line' && kind !== 'entity') {
    reader.fail('"kind" must be "line" (a sample line) or "entity" (a coloured dot)')
  }
  const label = nonBlank(reader, 'label')
  const fields = checkedStyle(reader, reader.rest(['op', 'id', 'kind', 'label']), LEGEND_FIELDS)
  checkLegendFields(reader, kind, fields)
  const given = reader.optionalString('id')
  let id = given
  if (id !== undefined) {
    if (!ID_PATTERN.test(id))
      reader.fail('"id" may use letters, digits, ".", "_" and "-" (up to 64)')
    if ((model.diagram.legend ?? []).some((e) => e.id === id)) {
      reader.fail(`"${id}" is already a legend entry`)
    }
  } else {
    for (let attempt = 0; attempt < 5 && id === undefined; attempt += 1) {
      const candidate = model.options.newId('legend')
      if (!(model.diagram.legend ?? []).some((e) => e.id === candidate)) id = candidate
    }
    if (id === undefined) reader.fail('could not make a unique id')
  }
  const present = Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== null))
  const entry = orderedLegend({ id, kind, label, ...present })
  model.diagram.legend = [...(model.diagram.legend ?? []), entry]
  return { op: 'add_legend_entry', legendEntry: entry }
}

function setLegendEntry(model: Model, reader: Reader): OperationResult {
  const current = legendOf(model, reader)
  const label = reader.has('label') ? nonBlank(reader, 'label') : current.label
  const changes = checkedStyle(reader, reader.rest(['op', 'id', 'label']), LEGEND_FIELDS)
  checkLegendFields(reader, current.kind, changes)
  const next: Record<string, unknown> = { ...current, label }
  for (const [key, value] of Object.entries(changes)) {
    if (value === null) delete next[key]
    else next[key] = value
  }
  const entry = orderedLegend(next)
  model.diagram.legend = (model.diagram.legend ?? []).map((e) => (e.id === current.id ? entry : e))
  return { op: 'set_legend_entry', legendEntry: entry }
}

function removeLegendEntry(model: Model, reader: Reader): OperationResult {
  const current = legendOf(model, reader)
  const next = (model.diagram.legend ?? []).filter((e) => e.id !== current.id)
  if (next.length > 0) model.diagram.legend = next
  else delete model.diagram.legend
  return { op: 'remove_legend_entry', removed: [current.id] }
}

// --- a link to another diagram and a note

function linkable(model: Model, reader: Reader): DiagramNode {
  const id = reader.string('id')
  const node = model.node(id)
  if (!node) reader.fail(`"${id}" is not an element of this diagram`)
  if (node.type === 'text' || node.type === 'line') {
    reader.fail(`"${id}" is a ${node.type}; only entities and containers take a link or a note`)
  }
  return node
}

// A path to store in the diagram: relative to it, with "/". Whether the caller allows it (inside the
// folder the assistant may use) is the caller's call (ApplyOptions.checkReference).
function storedPath(model: Model, reader: Reader, key: string): string {
  const path = reader.string(key).trim().replaceAll('\\', '/')
  if (path === '' || path.startsWith('/') || /^[A-Za-z]:/.test(path) || path.includes('\0')) {
    reader.fail(`"${key}" must be a path relative to this diagram, such as "orders/Orders.chd"`)
  }
  const refusal = model.options.checkReference?.(path)
  if (refusal) reader.fail(refusal)
  return path
}

function setLink(model: Model, reader: Reader): OperationResult {
  const node = linkable(model, reader)
  const path = storedPath(model, reader, 'path')
  if (!path.toLowerCase().endsWith('.chd')) reader.fail('a link points at another .chd diagram')
  node.data.linkedDiagram = path
  return { op: 'set_link', element: summarizeNode(model.diagram, node), link: path }
}

function removeLink(model: Model, reader: Reader): OperationResult {
  const node = linkable(model, reader)
  if (!node.data.linkedDiagram) reader.fail(`"${node.id}" has no link`)
  const was = node.data.linkedDiagram
  delete node.data.linkedDiagram
  return { op: 'remove_link', element: summarizeNode(model.diagram, node), removed: [was] }
}

// "<first line of the label>-<id>.md", the app's own naming with the id in place of its UUID suffix.
function noteFileName(node: DiagramNode): string {
  const first = node.data.label.split(/\r?\n/)[0]
  const cleaned = [...first]
    .map((c) => (c.charCodeAt(0) < 32 || '\\/:*?"<>|'.includes(c) ? ' ' : c))
    .join('')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60)
  const base = cleaned.replace(/^[. ]+|[. ]+$/g, '')
  return `${base || 'note'}-${node.id}.md`
}

function setNote(model: Model, reader: Reader): OperationResult {
  const node = linkable(model, reader)
  const text = nonBlank(reader, 'text')
  if (text.length > MAX_NOTE_CHARS)
    reader.fail(`"text" is longer than ${MAX_NOTE_CHARS} characters`)
  if (node.data.notes) {
    reader.fail(
      `"${node.id}" already has a note (${node.data.notes}): read it with read_file and change it with update_file`
    )
  }
  const folder = model.options.notesFolder
  if (folder === undefined) reader.fail('notes cannot be written here')
  const path = `${folder}/${noteFileName(node)}`
  const refusal = model.options.checkReference?.(path)
  if (refusal) reader.fail(refusal)
  model.files.push({ path, content: text.endsWith('\n') ? text : `${text}\n` })
  node.data.notes = path
  return { op: 'set_note', element: summarizeNode(model.diagram, node), note: path }
}

// Only the reference goes: the note file stays where it is, and this tool never deletes a file.
function removeNote(model: Model, reader: Reader): OperationResult {
  const node = linkable(model, reader)
  if (!node.data.notes) reader.fail(`"${node.id}" has no note`)
  const was = node.data.notes
  delete node.data.notes
  return { op: 'remove_note', element: summarizeNode(model.diagram, node), removed: [was] }
}

export const ANNOTATION_OPERATIONS: Record<
  string,
  (model: Model, reader: Reader) => OperationResult
> = {
  set_tag: setTag,
  remove_tag: removeTag,
  set_diagram_tag: setDiagramTag,
  remove_diagram_tag: removeDiagramTag,
  set_required_tag: setRequiredTag,
  remove_required_tag: removeRequiredTag,
  set_highlight: setHighlight,
  remove_highlight: removeHighlight,
  add_legend_entry: addLegendEntry,
  set_legend_entry: setLegendEntry,
  remove_legend_entry: removeLegendEntry,
  set_link: setLink,
  remove_link: removeLink,
  set_note: setNote,
  remove_note: removeNote
}
