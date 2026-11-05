// A diagram metamodel (ADR 0131): the rules of one architectural style, applied to a diagram.
// The file format is specified in docs/metamodel-format.md.

export type EdgeMeaning = 'dependsOn' | 'flowsTo' | 'irrelevant'
export type EdgePresence = 'required' | 'optional' | 'forbidden'
export type Severity = 'error' | 'warning' | 'info'
export type RoleNodeType = 'entity' | 'container' | 'text'

export interface RoleMatch {
  type?: RoleNodeType
  tag?: { key: string; value?: string | string[] }
  insideRole?: string
}

export interface Role {
  description?: string
  match: RoleMatch
}

interface RuleBase {
  id: string
  severity?: Severity
  message?: string
}

// "*" in a role position means any entity, container or text node.
export interface ForbiddenEdgeRule extends RuleBase {
  kind: 'forbiddenEdge'
  from: string
  to: string
}

export interface RequiredEdgeRule extends RuleBase {
  kind: 'requiredEdge'
  each: string
  edge: 'outgoing' | 'incoming' | 'either'
  with: string
}

export interface ContainmentRule extends RuleBase {
  kind: 'containment'
  each: string
  mustBeInside?: string
  mustNotBeInside?: string
}

export type RequiredProperty = 'label' | { tag: string }

export interface RequiredPropertyRule extends RuleBase {
  kind: 'requiredProperty'
  // A role, "*", or "@edges" for the edges.
  each: string
  property: RequiredProperty
}

export interface MaxElementsRule extends RuleBase {
  kind: 'maxElements'
  of: string
  max: number
}

export type Rule =
  ForbiddenEdgeRule | RequiredEdgeRule | ContainmentRule | RequiredPropertyRule | MaxElementsRule

export interface Metamodel {
  metamodelVersion: 1
  name: string
  description?: string
  edges: { meaning: EdgeMeaning; presence: EdgePresence }
  roles: Record<string, Role>
  rules: Rule[]
}

// A metamodel file is named <name>.chdmeta.
export const METAMODEL_FILE_SUFFIX = '.chdmeta'
// What the suffix was before the rename; such a file is still read, never written.
export const LEGACY_METAMODEL_FILE_SUFFIX = '.chdprofile.json'

// The name a metamodel file goes by (its file name without the suffix), or null if the file name is
// not a metamodel's under either suffix.
export function metamodelFileBase(file: string): string | null {
  const lower = file.toLowerCase()
  for (const suffix of [METAMODEL_FILE_SUFFIX, LEGACY_METAMODEL_FILE_SUFFIX]) {
    if (lower.endsWith(suffix)) return file.slice(0, -suffix.length)
  }
  return null
}

export const ANY_ROLE = '*'
export const EDGES_TARGET = '@edges'

// The rules that read an edge's direction.
export function needsDirection(rule: Rule): boolean {
  return rule.kind === 'forbiddenEdge' || rule.kind === 'requiredEdge'
}
