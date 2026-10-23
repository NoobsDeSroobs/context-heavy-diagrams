import type { DiagramEdge, DiagramFile, DiagramNode, JsonValue } from '../diagram/index.ts'
import { normalizeText } from './normalize.ts'
import {
  ANY_ROLE,
  EDGES_TARGET,
  needsDirection,
  type Profile,
  type RoleMatch,
  type Rule,
  type Severity
} from './profile.ts'

// Applies a validated profile to a diagram (ADR 0131). Pure: the same diagram and profile always
// give the same result, so the app, the command line and the tests all see one answer.

export interface Finding {
  // The rule's id, or "edge-set" / "edge-presence" for the profile's `edges` declaration.
  ruleId: string
  severity: Severity
  message: string
  // The specific offenders in words (labels), when there are any.
  detail?: string
  nodeIds: string[]
  edgeIds: string[]
}

export interface CheckResult {
  profileName: string
  findings: Finding[]
  // Rules that could not run, because the diagram lacks the edge set they need.
  notEvaluated: string[]
  // No finding of severity "error".
  conforms: boolean
}

type NodeKind = 'entity' | 'container' | 'text'

// An edge as the profile reads it: its ends in the reading of the edge set the meaning asks for.
interface OrientedEdge {
  id: string
  source: string
  target: string
}

// Only entities, containers and text nodes can have a role; freeform lines never do.
function nodeKind(node: DiagramNode): NodeKind | null {
  if (node.type === 'line') return null
  return node.type === 'container' || node.type === 'text' ? node.type : 'entity'
}

function tagValues(value: JsonValue): string[] {
  const list = Array.isArray(value) ? value : [value]
  return list.flatMap((item) =>
    typeof item === 'string' || typeof item === 'number' || typeof item === 'boolean'
      ? [normalizeText(String(item))]
      : []
  )
}

function tagEntry(
  metadata: Record<string, { value: JsonValue }> | undefined,
  key: string
): JsonValue | undefined {
  const wanted = normalizeText(key)
  for (const [name, entry] of Object.entries(metadata ?? {})) {
    if (normalizeText(name) === wanted) return entry.value
  }
  return undefined
}

function isBlank(value: JsonValue | undefined): boolean {
  if (value === undefined || value === null) return true
  if (typeof value === 'string') return value.trim() === ''
  if (Array.isArray(value)) return value.length === 0
  return false
}

export function checkDiagram(diagram: DiagramFile, profile: Profile): CheckResult {
  const findings: Finding[] = []
  const notEvaluated: string[] = []
  const nodes = new Map(diagram.nodes.map((node) => [node.id, node]))
  const labelOf = (id: string): string => {
    const node = nodes.get(id)
    return node?.data.label ? `"${node.data.label}"` : `"${id}"`
  }
  const eligible = diagram.nodes.filter((node) => nodeKind(node) !== null)

  // -- the edges, in the reading the profile's meaning asks for
  const { meaning, presence } = profile.edges
  let edges: OrientedEdge[] = []
  let directionAvailable = true
  const asIs = (edge: DiagramEdge): OrientedEdge => ({
    id: edge.id,
    source: edge.source,
    target: edge.target
  })
  if (meaning === 'dependsOn' || meaning === 'flowsTo') {
    const wanted = normalizeText(meaning)
    const sets = (diagram.edgeDirectionSets ?? []).filter((s) => normalizeText(s.name) === wanted)
    if (sets.length !== 1) {
      directionAvailable = false
      findings.push({
        ruleId: 'edge-set',
        severity: 'error',
        message:
          sets.length === 0
            ? `Missing required edge set: the diagram needs an edge direction set named "${meaning}" (spaces and capitals do not matter).`
            : `More than one edge direction set is named "${meaning}"; the diagram must have exactly one.`,
        nodeIds: [],
        edgeIds: []
      })
    } else {
      // With two or more sets every edge stores its orientation in each of them; with one, the
      // edge's own source and target are that reading.
      const setId = sets[0].id
      const many = (diagram.edgeDirectionSets ?? []).length >= 2
      edges = diagram.edges.map((edge) => {
        const stored = many ? edge.directionSets?.[setId] : undefined
        return stored ? { ...asIs(edge), source: stored.source, target: stored.target } : asIs(edge)
      })
    }
  }
  if (!(meaning === 'dependsOn' || meaning === 'flowsTo') || !directionAvailable) {
    edges = diagram.edges.map(asIs)
  }
  edges = edges.filter((e) => nodes.has(e.source) && nodes.has(e.target))

  if (presence === 'required' && diagram.edges.length === 0) {
    findings.push({
      ruleId: 'edge-presence',
      severity: 'error',
      message: 'The diagram has no edges, but this profile requires them.',
      nodeIds: [],
      edgeIds: []
    })
  } else if (presence === 'forbidden' && diagram.edges.length > 0) {
    findings.push({
      ruleId: 'edge-presence',
      severity: 'error',
      message: 'The diagram has edges, but this profile does not allow any.',
      nodeIds: [],
      edgeIds: diagram.edges.map((edge) => edge.id)
    })
  }

  // -- roles
  const byRole = new Map<string, Set<string>>()
  const roleDefs = new Map(
    Object.entries(profile.roles).map(([name, role]) => [normalizeText(name), role.match])
  )
  const ancestors = (id: string): string[] => {
    const chain: string[] = []
    const seen = new Set([id])
    let parent = nodes.get(id)?.parentId
    while (parent && !seen.has(parent) && nodes.has(parent)) {
      chain.push(parent)
      seen.add(parent)
      parent = nodes.get(parent)?.parentId
    }
    return chain
  }
  const members = (roleName: string): Set<string> => {
    const key = normalizeText(roleName)
    const known = byRole.get(key)
    if (known) return known
    const match = roleDefs.get(key) as RoleMatch
    // Set first: a role never refers back to itself (validated), this just keeps the call finite.
    const result = new Set<string>()
    byRole.set(key, result)
    const container = match.insideRole ? members(match.insideRole) : null
    for (const node of eligible) {
      if (match.type && nodeKind(node) !== match.type) continue
      if (match.tag) {
        const value = tagEntry(node.metadata, match.tag.key)
        if (value === undefined) continue
        if (match.tag.value !== undefined) {
          const wanted = (Array.isArray(match.tag.value) ? match.tag.value : [match.tag.value]).map(
            normalizeText
          )
          if (!tagValues(value).some((have) => wanted.includes(have))) continue
        }
      }
      if (container && !ancestors(node.id).some((id) => container.has(id))) continue
      result.add(node.id)
    }
    return result
  }
  const allEligible = new Set(eligible.map((node) => node.id))
  const set = (role: string): Set<string> => (role === ANY_ROLE ? allEligible : members(role))

  // -- rules
  const add = (
    rule: Rule,
    defaultMessage: string,
    nodeIds: string[],
    edgeIds: string[],
    detail?: string
  ): void => {
    findings.push({
      ruleId: rule.id,
      severity: rule.severity ?? 'error',
      message: rule.message ?? defaultMessage,
      ...(detail ? { detail } : {}),
      nodeIds,
      edgeIds
    })
  }

  for (const rule of profile.rules) {
    if (needsDirection(rule) && !directionAvailable) {
      notEvaluated.push(rule.id)
      continue
    }
    switch (rule.kind) {
      case 'forbiddenEdge': {
        const from = set(rule.from)
        const to = set(rule.to)
        for (const e of edges) {
          if (from.has(e.source) && to.has(e.target)) {
            add(
              rule,
              'This edge is not allowed.',
              [e.source, e.target],
              [e.id],
              `${labelOf(e.source)} to ${labelOf(e.target)}`
            )
          }
        }
        break
      }
      case 'requiredEdge': {
        const others = set(rule.with)
        for (const id of set(rule.each)) {
          const found = edges.some((e) => {
            const out = e.source === id && others.has(e.target)
            const inc = e.target === id && others.has(e.source)
            return rule.edge === 'outgoing' ? out : rule.edge === 'incoming' ? inc : out || inc
          })
          if (!found) {
            add(
              rule,
              `The element has no ${rule.edge} edge to a required element.`,
              [id],
              [],
              labelOf(id)
            )
          }
        }
        break
      }
      case 'containment': {
        const container = set((rule.mustBeInside ?? rule.mustNotBeInside) as string)
        for (const id of set(rule.each)) {
          const inside = ancestors(id).some((ancestor) => container.has(ancestor))
          if (rule.mustBeInside !== undefined && !inside) {
            add(rule, 'The element must be inside the required container.', [id], [], labelOf(id))
          } else if (rule.mustNotBeInside !== undefined && inside) {
            add(rule, 'The element must not be inside this container.', [id], [], labelOf(id))
          }
        }
        break
      }
      case 'requiredProperty': {
        const missing = (value: JsonValue | undefined): boolean => isBlank(value)
        if (rule.each === EDGES_TARGET) {
          for (const edge of diagram.edges) {
            const value =
              rule.property === 'label' ? edge.label : tagEntry(edge.metadata, rule.property.tag)
            if (missing(value)) {
              add(
                rule,
                'The edge lacks a required property.',
                [edge.source, edge.target],
                [edge.id],
                `${labelOf(edge.source)} to ${labelOf(edge.target)}`
              )
            }
          }
        } else {
          for (const id of set(rule.each)) {
            const node = nodes.get(id) as DiagramNode
            const value =
              rule.property === 'label'
                ? node.data.label
                : tagEntry(node.metadata, rule.property.tag)
            if (missing(value)) {
              add(rule, 'The element lacks a required property.', [id], [], labelOf(id))
            }
          }
        }
        break
      }
      case 'maxElements': {
        const count = set(rule.of).size
        if (count > rule.max) {
          add(rule, `The diagram has ${count} elements; the limit is ${rule.max}.`, [], [])
        }
        break
      }
    }
  }

  return {
    profileName: profile.name,
    findings,
    notEvaluated,
    conforms: !findings.some((finding) => finding.severity === 'error')
  }
}
