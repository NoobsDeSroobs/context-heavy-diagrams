import { normalizeText } from './normalize.ts'
import { ANY_ROLE, EDGES_TARGET, type Profile } from './profile.ts'

// Checks a parsed profile against docs/conformance-profile-format.md (ADR 0131). Every problem is
// collected, not just the first, so an author fixes a file in one pass. A profile with any problem
// checks nothing: `profile` is null then.
export interface ProfileValidation {
  profile: Profile | null
  errors: string[]
}

type Json = Record<string, unknown>

const MEANINGS = ['dependsOn', 'flowsTo', 'irrelevant']
const PRESENCES = ['required', 'optional', 'forbidden']
const SEVERITIES = ['error', 'warning', 'info']
const NODE_TYPES = ['entity', 'container', 'text']
const EDGE_DIRECTIONS = ['outgoing', 'incoming', 'either']
const KINDS = ['forbiddenEdge', 'requiredEdge', 'containment', 'requiredProperty', 'maxElements']
const NAME_PATTERN = /^[A-Za-z0-9_-]+$/

const isObject = (value: unknown): value is Json =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
const isText = (value: unknown): value is string => typeof value === 'string' && value.trim() !== ''
const quoted = (list: string[]): string => list.map((item) => `"${item}"`).join(', ')

export function validateProfile(raw: unknown): ProfileValidation {
  const errors: string[] = []
  if (!isObject(raw)) return { profile: null, errors: ['A profile must be a JSON object.'] }

  const unknownKeys = (obj: Json, allowed: string[], where: string): void => {
    for (const key of Object.keys(obj)) {
      if (!allowed.includes(key)) errors.push(`${where}: unknown key "${key}".`)
    }
  }

  unknownKeys(raw, ['profileVersion', 'name', 'description', 'edges', 'roles', 'rules'], 'Profile')
  if (raw.profileVersion !== 1) {
    errors.push(`profileVersion must be 1 (found ${JSON.stringify(raw.profileVersion)}).`)
  }
  if (!isText(raw.name)) errors.push('name is required and must not be blank.')
  if (raw.description !== undefined && typeof raw.description !== 'string') {
    errors.push('description must be text.')
  }

  // -- edges
  let meaning: unknown
  let presence: unknown
  if (!isObject(raw.edges)) {
    errors.push('edges is required: an object with "meaning" and "presence".')
  } else {
    unknownKeys(raw.edges, ['meaning', 'presence'], 'edges')
    meaning = raw.edges.meaning
    presence = raw.edges.presence
    const chosen = (field: string, value: unknown, allowed: string[]): void => {
      if (value === undefined || value === 'none') {
        errors.push(`edges.${field} is not chosen yet; set it to one of ${quoted(allowed)}.`)
      } else if (typeof value !== 'string' || !allowed.includes(value)) {
        errors.push(
          `edges.${field} must be one of ${quoted(allowed)} (found ${JSON.stringify(value)}).`
        )
      }
    }
    chosen('meaning', meaning, MEANINGS)
    chosen('presence', presence, PRESENCES)
    if (presence === 'forbidden' && meaning !== undefined && meaning !== 'irrelevant') {
      errors.push('edges.presence "forbidden" requires edges.meaning "irrelevant".')
    }
  }
  const directional = meaning === 'dependsOn' || meaning === 'flowsTo'

  // -- roles
  const roleNames = new Set<string>()
  const insideRefs = new Map<string, string>()
  if (!isObject(raw.roles)) {
    errors.push('roles is required: an object, which may be empty.')
  } else {
    for (const name of Object.keys(raw.roles)) {
      if (!NAME_PATTERN.test(name)) {
        errors.push(`Role "${name}": a name uses only letters, digits, "-" and "_".`)
        continue
      }
      const key = normalizeText(name)
      if (roleNames.has(key)) errors.push(`Role "${name}": the name is used twice.`)
      roleNames.add(key)
    }
    for (const [name, role] of Object.entries(raw.roles)) {
      const where = `Role "${name}"`
      if (!isObject(role)) {
        errors.push(`${where}: must be an object with a "match".`)
        continue
      }
      unknownKeys(role, ['description', 'match'], where)
      if (role.description !== undefined && typeof role.description !== 'string') {
        errors.push(`${where}: description must be text.`)
      }
      const match = role.match
      if (!isObject(match) || Object.keys(match).length === 0) {
        errors.push(`${where}: match needs at least one of "type", "tag" and "insideRole".`)
        continue
      }
      unknownKeys(match, ['type', 'tag', 'insideRole'], `${where} match`)
      if (match.type !== undefined && !NODE_TYPES.includes(match.type as string)) {
        errors.push(`${where} match: type must be one of ${quoted(NODE_TYPES)}.`)
      }
      if (match.tag !== undefined) {
        const tag = match.tag
        if (!isObject(tag)) {
          errors.push(`${where} match: tag must be an object with a "key".`)
        } else {
          unknownKeys(tag, ['key', 'value'], `${where} match tag`)
          if (!isText(tag.key)) errors.push(`${where} match: tag.key is required.`)
          const value = tag.value
          const validValue =
            value === undefined ||
            isText(value) ||
            (Array.isArray(value) && value.length > 0 && value.every(isText))
          if (!validValue) {
            errors.push(
              `${where} match: tag.value must be text, or a list of text for any of several values.`
            )
          }
        }
      }
      if (match.insideRole !== undefined) {
        if (!isText(match.insideRole))
          errors.push(`${where} match: insideRole must be a role name.`)
        else insideRefs.set(normalizeText(name), match.insideRole)
      }
    }
    // insideRole must name a role, and the chain of insideRoles must not loop.
    for (const [from, target] of insideRefs) {
      if (!roleNames.has(normalizeText(target))) {
        errors.push(`A role is inside "${target}", which is not a role.`)
        insideRefs.delete(from)
      }
    }
    for (const start of insideRefs.keys()) {
      const seen = new Set<string>([start])
      let current = normalizeText(insideRefs.get(start) as string)
      while (insideRefs.has(current)) {
        if (seen.has(current)) {
          errors.push(`Roles are inside each other in a loop (through "${start}").`)
          break
        }
        seen.add(current)
        current = normalizeText(insideRefs.get(current) as string)
      }
    }
  }

  // -- rules
  const ruleIds = new Set<string>()
  if (!Array.isArray(raw.rules)) {
    errors.push('rules is required: a list, which may be empty.')
  } else {
    raw.rules.forEach((rule, index) => {
      if (!isObject(rule)) {
        errors.push(`Rule ${index + 1}: must be an object.`)
        return
      }
      const id = rule.id
      const where = `Rule ${typeof id === 'string' && id ? `"${id}"` : index + 1}`
      if (typeof id !== 'string' || !NAME_PATTERN.test(id)) {
        errors.push(`${where}: id is required and uses only letters, digits, "-" and "_".`)
      } else if (ruleIds.has(normalizeText(id))) {
        errors.push(`${where}: the id is used twice.`)
      } else {
        ruleIds.add(normalizeText(id))
      }
      if (rule.severity !== undefined && !SEVERITIES.includes(rule.severity as string)) {
        errors.push(`${where}: severity must be one of ${quoted(SEVERITIES)}.`)
      }
      if (rule.message !== undefined && typeof rule.message !== 'string') {
        errors.push(`${where}: message must be text.`)
      }

      // A role position: a role name, "*" for any element, and "@edges" where allowed.
      const role = (field: string, value: unknown, allowEdges = false): void => {
        if (!isText(value)) {
          errors.push(`${where}: "${field}" is required.`)
        } else if (value === ANY_ROLE || (allowEdges && value === EDGES_TARGET)) {
          return
        } else if (!roleNames.has(normalizeText(value))) {
          errors.push(`${where}: "${field}" names "${value}", which is not a role.`)
        }
      }

      const base = ['id', 'kind', 'severity', 'message']
      switch (rule.kind) {
        case 'forbiddenEdge':
          unknownKeys(rule, [...base, 'from', 'to'], where)
          role('from', rule.from)
          role('to', rule.to)
          break
        case 'requiredEdge':
          unknownKeys(rule, [...base, 'each', 'edge', 'with'], where)
          role('each', rule.each)
          role('with', rule.with)
          if (!EDGE_DIRECTIONS.includes(rule.edge as string)) {
            errors.push(`${where}: edge must be one of ${quoted(EDGE_DIRECTIONS)}.`)
          }
          break
        case 'containment': {
          unknownKeys(rule, [...base, 'each', 'mustBeInside', 'mustNotBeInside'], where)
          role('each', rule.each)
          const given = ['mustBeInside', 'mustNotBeInside'].filter((key) => key in rule)
          if (given.length !== 1) {
            errors.push(`${where}: give exactly one of "mustBeInside" and "mustNotBeInside".`)
          } else if (rule[given[0]] === ANY_ROLE) {
            errors.push(`${where}: "${given[0]}" needs a role, not "*".`)
          } else {
            role(given[0], rule[given[0]])
          }
          break
        }
        case 'requiredProperty': {
          unknownKeys(rule, [...base, 'each', 'property'], where)
          role('each', rule.each, true)
          const property = rule.property
          const validProperty =
            property === 'label' ||
            (isObject(property) &&
              Object.keys(property).join() === 'tag' &&
              isText((property as Json).tag))
          if (!validProperty) {
            errors.push(`${where}: property must be "label" or { "tag": "key" }.`)
          }
          if (rule.each === EDGES_TARGET && presence === 'forbidden') {
            errors.push(`${where}: edges are forbidden, so there is nothing to check on them.`)
          }
          break
        }
        case 'maxElements':
          unknownKeys(rule, [...base, 'of', 'max'], where)
          role('of', rule.of)
          if (!Number.isInteger(rule.max) || (rule.max as number) < 1) {
            errors.push(`${where}: max must be a whole number of at least 1.`)
          }
          break
        default:
          errors.push(`${where}: kind must be one of ${quoted(KINDS)}.`)
      }
      if (
        (rule.kind === 'forbiddenEdge' || rule.kind === 'requiredEdge') &&
        meaning !== undefined &&
        !directional &&
        MEANINGS.includes(meaning as string)
      ) {
        errors.push(
          `${where}: "${rule.kind}" needs a direction, so edges.meaning must be "dependsOn" or "flowsTo".`
        )
      }
    })
  }

  return errors.length === 0
    ? { profile: raw as unknown as Profile, errors }
    : { profile: null, errors }
}
