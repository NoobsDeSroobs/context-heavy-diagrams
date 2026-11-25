import { firstFreeName, labelToFileStem } from '../labelFileName.ts'

// Where a note belongs, derived from its element's label + id — the one definition, used by the save
// planner (ADR 0092: derived at save, never stored) and by the assistant's set_note, so a person and
// an assistant get the same name for the same element (ADR 0060). `<label stem>-<tail>.md` inside the
// diagram's sibling `<diagram name>/notes/` folder. Returned relative to the diagram file's
// directory, '/'-separated, so it can be stored as-is in `data.notes`.

// The diagram file's name without directory or extension (Windows or POSIX
// separators — a diagram path is whatever the OS handed us).
export function diagramBaseName(diagramPath: string): string {
  const name = diagramPath.split(/[\\/]/).pop() ?? diagramPath
  const dot = name.lastIndexOf('.')
  return dot > 0 ? name.slice(0, dot) : name
}

const UUID_END = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// How much of an element's UUID goes in the name. Six characters keep two notes of the same label
// apart in practice; when two notes of one diagram still get the same name, the next length is tried
// for them, ending with the whole UUID.
const TAIL_LENGTHS = [6, 8, 12, Infinity] as const

// The end of the element's id: the last `length` characters of a UUID the id ends with (the last
// group of a UUID is all random), or the whole id when it does not end in one.
export function noteTail(nodeId: string, length: number = TAIL_LENGTHS[0]): string {
  const uuid = UUID_END.exec(nodeId)?.[0]
  if (uuid === undefined) return nodeId
  return length >= uuid.length ? uuid : uuid.slice(-length)
}

export interface NoteOwner {
  id: string
  label: string
}

// The file name of each element's note, unique among the notes of one diagram (compared ignoring case:
// a folder moves between systems, ADR 0181). Elements get the short tail unless that makes two names
// alike, then those get a longer one. Only elements that have a note belong in `owners`.
export function derivedNoteFileNames(owners: readonly NoteOwner[]): Map<string, string> {
  const stems = new Map(owners.map((o) => [o.id, labelToFileStem(o.label, 'untitled')]))
  const level = new Map(owners.map((o) => [o.id, 0]))
  const nameOf = (id: string): string =>
    `${stems.get(id)}-${noteTail(id, TAIL_LENGTHS[level.get(id) ?? 0])}.md`

  for (;;) {
    const groups = new Map<string, string[]>()
    for (const o of owners) {
      const key = nameOf(o.id).toLowerCase()
      groups.set(key, [...(groups.get(key) ?? []), o.id])
    }
    let bumped = false
    for (const ids of groups.values()) {
      if (ids.length < 2) continue
      for (const id of ids) {
        const next = (level.get(id) ?? 0) + 1
        if (next < TAIL_LENGTHS.length) {
          level.set(id, next)
          bumped = true
        }
      }
    }
    if (!bumped) break
  }

  // Ids that differ only by case, or have no UUID to lengthen with, can still be alike: the later
  // one takes the next free number.
  const taken = new Set<string>()
  const names = new Map<string, string>()
  for (const o of owners) {
    const name = nameOf(o.id)
    const free = firstFreeName(name.slice(0, -'.md'.length), '.md', (n) =>
      taken.has(n.toLowerCase())
    )
    taken.add(free.toLowerCase())
    names.set(o.id, free)
  }
  return names
}

export function derivedNotesPaths(
  diagramPath: string,
  owners: readonly NoteOwner[]
): Map<string, string> {
  const folder = `${diagramBaseName(diagramPath)}/notes`
  return new Map([...derivedNoteFileNames(owners)].map(([id, name]) => [id, `${folder}/${name}`]))
}
