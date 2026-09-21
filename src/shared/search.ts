import type { IconRef, IconSlot, MetadataEntry } from './diagram'

// Pure free-text matcher behind ADR 0062's V1 search — one
// combined query checked against id, label, and every tag key/value,
// deliberately not split into per-field syntax yet (that's the deferred
// `metadata:*python*`-style scoping the ADR logs for later). Case-
// insensitive substring match, same "matches in some way" framing the
// user gave when this was first raised.
export interface SearchableElement {
  id: string
  label?: string
  metadata?: Record<string, MetadataEntry>
  // Only nodes carry these; an edge (or any element without them) simply
  // fails the matching `has:` / icon criterion.
  icons?: Partial<Record<IconSlot, IconRef>>
  references?: string[]
  details?: string
  linkedDiagram?: string
}

function stringifyMetadataValue(entry: MetadataEntry): string {
  return typeof entry.value === 'string' ? entry.value : JSON.stringify(entry.value)
}

export function matchesSearchQuery(query: string, element: SearchableElement): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return false
  if (element.id.toLowerCase().includes(q)) return true
  if (element.label && element.label.toLowerCase().includes(q)) return true
  if (element.metadata) {
    for (const [key, entry] of Object.entries(element.metadata)) {
      if (key.toLowerCase().includes(q)) return true
      if (stringifyMetadataValue(entry).toLowerCase().includes(q)) return true
    }
  }
  return false
}

// Icon-identity search (see ADR 0072) — pick an icon already placed
// somewhere in the diagram, find every other node carrying that same
// icon. A built-in icon is fully identified by its id, a custom one by its
// relative asset path (both plain strings on IconRef), so "same icon" is
// exact equality on the (source, id|path) pair — no fuzzy name matching.
// This is deliberately its own one-dimension search, not combined with the
// free-text query above; ADR 0062 defers all criteria-combining to a
// future real query language.
export function iconRefKey(icon: IconRef): string {
  return icon.source === 'builtin' ? `builtin:${icon.id}` : `custom:${icon.path}`
}

export function nodeHasIcon(
  picked: IconRef,
  icons: Partial<Record<IconSlot, IconRef>> | undefined
): boolean {
  if (!icons) return false
  const key = iconRefKey(picked)
  return Object.values(icons).some((ref) => ref !== undefined && iconRefKey(ref) === key)
}

// Builds the searchable view of one React Flow node/edge from its `data`.
export function searchableFromData(
  id: string,
  data: Record<string, unknown> | undefined
): SearchableElement {
  return {
    id,
    label: typeof data?.label === 'string' ? data.label : undefined,
    metadata: data?.metadata as Record<string, MetadataEntry> | undefined,
    icons: data?.icons as Partial<Record<IconSlot, IconRef>> | undefined,
    references: Array.isArray(data?.references) ? (data.references as string[]) : undefined,
    details: typeof data?.details === 'string' ? data.details : undefined,
    linkedDiagram: typeof data?.linkedDiagram === 'string' ? data.linkedDiagram : undefined
  }
}

// The query language (ADR 0096): whitespace-separated terms in the one search
// box, all ANDed — an element must satisfy every term. There is deliberately
// no OR, NOT or grouping. A term is either free text or `name:value`:
//   any:web  (or bare text)   id, label or a tag key/value contains it
//   label:web                 the label contains it
//   id:web                    the element id contains it
//   tag:gdpr                  a tag's key or value contains it
//   tag:owner=alice           one tag whose key contains "owner" AND value contains "alice"
//   has:references | has:icon | has:details | has:link   the element carries one
// Each run of consecutive bare words is ONE `any` term, matched as a single
// substring ("web server" is a phrase); a `name:value` term ends the run, so
// "customer label:x db" is three terms. Values may be quoted to contain
// spaces (tag:"data class"=pii). An unrecognised `word:` prefix stays plain
// text (labels like "Note: x" keep working); an empty value or an unknown
// `has:` value is reported as a problem instead of silently matching nothing.
export const HAS_FACETS = ['references', 'icon', 'details', 'link'] as const
export type HasFacet = (typeof HAS_FACETS)[number]

const HAS_ALIASES: Record<string, HasFacet> = {
  references: 'references',
  reference: 'references',
  refs: 'references',
  images: 'references',
  icon: 'icon',
  icons: 'icon',
  details: 'details',
  notes: 'details',
  link: 'link',
  links: 'link'
}

export interface TagTerm {
  key?: string
  value: string
}

export interface ParsedQuery {
  any: string[]
  labels: string[]
  ids: string[]
  tags: TagTerm[]
  has: HasFacet[]
  problems: string[]
}

const stripQuotes = (s: string): string => s.replace(/"/g, '')

export function parseSearchQuery(raw: string): ParsedQuery {
  const parsed: ParsedQuery = { any: [], labels: [], ids: [], tags: [], has: [], problems: [] }
  let run: string[] = []
  const flushRun = (): void => {
    if (run.length > 0) parsed.any.push(run.join(' '))
    run = []
  }
  // A term is a run of non-space characters, where a quoted section may
  // contain spaces.
  for (const term of raw.match(/(?:[^\s"]+|"[^"]*")+/g) ?? []) {
    const m = /^(any|label|id|tag|has):(.*)$/is.exec(term)
    if (!m) {
      run.push(stripQuotes(term))
      continue
    }
    flushRun()
    const name = m[1].toLowerCase()
    const value = stripQuotes(m[2]).trim()
    if (!value) {
      parsed.problems.push(`${name}: needs a value`)
    } else if (name === 'has') {
      const facet = HAS_ALIASES[value.toLowerCase()]
      if (!facet) parsed.problems.push(`has:${value} — try has:${HAS_FACETS.join(', has:')}`)
      else if (!parsed.has.includes(facet)) parsed.has.push(facet)
    } else if (name === 'tag') {
      const eq = value.indexOf('=')
      parsed.tags.push(
        eq > 0
          ? { key: value.slice(0, eq).toLowerCase(), value: value.slice(eq + 1).toLowerCase() }
          : { value: value.toLowerCase() }
      )
    } else if (name === 'label') {
      parsed.labels.push(value)
    } else if (name === 'id') {
      parsed.ids.push(value)
    } else {
      parsed.any.push(value)
    }
  }
  flushRun()
  return parsed
}

// The parsed query plus an optional picked icon (ADR 0072), ANDed. This is the
// one predicate every search path shares (the open diagram today; linked
// diagrams' parsed elements for drill-down search), so a term added here
// reaches all of them.
export interface SearchCriteria {
  any: string[]
  labels: string[]
  ids: string[]
  tags: TagTerm[]
  has: HasFacet[]
  icon: IconRef | null
}

export function criteriaFromQuery(raw: string, icon: IconRef | null): SearchCriteria {
  const { any, labels, ids, tags, has } = parseSearchQuery(raw)
  return { any, labels, ids, tags, has, icon }
}

export function hasSearchCriteria(c: SearchCriteria): boolean {
  return (
    c.any.length > 0 ||
    c.labels.length > 0 ||
    c.ids.length > 0 ||
    c.tags.length > 0 ||
    c.has.length > 0 ||
    c.icon !== null
  )
}

function matchesTagTerm(
  term: TagTerm,
  metadata: Record<string, MetadataEntry> | undefined
): boolean {
  if (!metadata) return false
  return Object.entries(metadata).some(([key, entry]) => {
    const k = key.toLowerCase()
    const v = stringifyMetadataValue(entry).toLowerCase()
    return term.key !== undefined
      ? k.includes(term.key) && v.includes(term.value)
      : k.includes(term.value) || v.includes(term.value)
  })
}

function hasFacet(facet: HasFacet, el: SearchableElement): boolean {
  switch (facet) {
    case 'references':
      return !!el.references && el.references.length > 0
    case 'icon':
      return !!el.icons && Object.values(el.icons).some((ref) => ref !== undefined)
    case 'details':
      return !!el.details
    case 'link':
      return !!el.linkedDiagram
  }
}

// Every term except the bare/`any:` ones — vacuously true when none is set.
// Split out so deep search can skip reading a details file for an element that
// already fails these in-memory terms.
export function matchesStructuredCriteria(c: SearchCriteria, el: SearchableElement): boolean {
  if (c.icon && !nodeHasIcon(c.icon, el.icons)) return false
  if (!c.has.every((f) => hasFacet(f, el))) return false
  if (!c.tags.every((t) => matchesTagTerm(t, el.metadata))) return false
  if (!c.labels.every((l) => !!el.label && el.label.toLowerCase().includes(l.toLowerCase()))) {
    return false
  }
  if (!c.ids.every((i) => el.id.toLowerCase().includes(i.toLowerCase()))) return false
  return true
}

// False for an empty criteria set — nothing to search for is "no matches",
// not "everything".
export function elementMatchesCriteria(c: SearchCriteria, el: SearchableElement): boolean {
  if (!hasSearchCriteria(c)) return false
  return c.any.every((term) => matchesSearchQuery(term, el)) && matchesStructuredCriteria(c, el)
}

// The second, costlier tier of a match (ADR 0097): a bare/`any:` term the
// in-memory fields don't satisfy may be satisfied by the element's details file.
// Only meaningful for an element that fails elementMatchesCriteria; the file is
// read only when it already passes every other term and is missing some `any`
// term, and it matches when the file supplies each missing one. `readDetails`
// resolves the element's stored details path (it must not throw — an
// unreadable file is just empty text). Callers run the in-memory tier for
// everything first and this only for what's left.
export async function elementMatchesViaDetails(
  c: SearchCriteria,
  el: SearchableElement,
  readDetails: (relativePath: string) => Promise<string>
): Promise<boolean> {
  if (!hasSearchCriteria(c) || !el.details || !matchesStructuredCriteria(c, el)) return false
  const missing = c.any.filter((term) => !matchesSearchQuery(term, el))
  if (missing.length === 0) return false
  const content = (await readDetails(el.details)).toLowerCase()
  return missing.every((term) => content.includes(term.toLowerCase()))
}

export async function elementMatchesWithDetails(
  c: SearchCriteria,
  el: SearchableElement,
  readDetails: (relativePath: string) => Promise<string>
): Promise<boolean> {
  return elementMatchesCriteria(c, el) || (await elementMatchesViaDetails(c, el, readDetails))
}
