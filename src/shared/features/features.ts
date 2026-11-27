import type { DiagramFile } from '../diagram'

// Beta features: shipped in a release but off until a person opts in, so the maintainer can gather
// testing before deciding to make one core, postpone it or delete it. Only this registry says what
// is a beta; the Preferences list, the way into each feature, the labels an assistant sees and the
// review-date test all read it. Off hides the way in (a button, a menu item, a kind in the picker),
// never the data: what a beta wrote still opens, draws and round-trips with it off.

export interface BetaFeature {
  // Stable handle stored in the preferences; never reused for another feature.
  id: string
  // Shown in the list in Preferences, in the notes an assistant gets and in the spec.
  label: string
  // What to try, in a sentence or two.
  description: string
  // The date (YYYY-MM-DD) by which the maintainer decides: delete, postpone (a later date) or
  // promote. A test fails once it has passed.
  reviewBy: string
  // How a tester reports back, when it is not the usual way.
  report?: string
  // Kinds of behaviour this feature adds. They are labelled beta in what assistants read, hidden
  // from the pickers while the feature is off, and make a diagram that uses one "use" the feature.
  kinds?: readonly string[]
  // For a feature that adds a field or an operation instead of a kind: whether a diagram uses it.
  usedBy?: (diagram: DiagramFile) => boolean
}

// None at the moment. A beta is added here, with its `reviewBy`, together with the code behind it.
export const BETA_FEATURES: readonly BetaFeature[] = []

export type FeatureFlags = Readonly<Record<string, boolean>>

// The stored flags, kept only for features the registry knows (a deleted beta's id is dropped, so an
// old preferences file never breaks) and only as booleans; a feature never switched on is off.
export function normalizeFeatures(
  raw: unknown,
  registry: readonly BetaFeature[] = BETA_FEATURES
): Record<string, boolean> {
  const stored: Record<string, unknown> =
    typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {}
  const flags: Record<string, boolean> = {}
  for (const feature of registry) flags[feature.id] = stored[feature.id] === true
  return flags
}

export function isBetaOn(
  features: FeatureFlags | undefined,
  id: string,
  registry: readonly BetaFeature[] = BETA_FEATURES
): boolean {
  return registry.some((f) => f.id === id) && features?.[id] === true
}

// The beta feature a kind of behaviour belongs to, if any.
export function betaOfKind(
  kindId: string,
  registry: readonly BetaFeature[] = BETA_FEATURES
): BetaFeature | undefined {
  return registry.find((f) => f.kinds?.includes(kindId))
}

// Whether a picker offers a kind: every kind that is not in a beta, and a beta's kinds while it is
// on. A kind a diagram already uses is drawn whatever this says.
export function kindIsOffered(
  kindId: string,
  features: FeatureFlags | undefined,
  registry: readonly BetaFeature[] = BETA_FEATURES
): boolean {
  const beta = betaOfKind(kindId, registry)
  return beta === undefined || features?.[beta.id] === true
}

// Kind ids as one comma-separated list for a tool's help and errors, a beta's kind marked.
export function kindListText(
  kindIds: readonly string[],
  registry: readonly BetaFeature[] = BETA_FEATURES
): string {
  return kindIds.map((id) => (betaOfKind(id, registry) ? `${id} (beta)` : id)).join(', ')
}

// The betas this diagram uses, one line each, for what an assistant is told after it reads or edits
// the diagram. A note, never an error: the diagram is valid.
export function betaNotes(
  diagram: DiagramFile,
  registry: readonly BetaFeature[] = BETA_FEATURES
): string[] {
  const kindsUsed = new Set(
    diagram.nodes.map((n) => n.data.kind).filter((k): k is string => typeof k === 'string')
  )
  return registry
    .filter((f) => f.kinds?.some((k) => kindsUsed.has(k)) || f.usedBy?.(diagram) === true)
    .map(
      (f) =>
        `uses the beta feature "${f.label}" (reviewed by ${f.reviewBy}): it may change or be removed`
    )
}

// What an answer carries: a `beta` list when the diagram uses any, nothing otherwise.
export function betaAnswer(
  diagram: DiagramFile,
  registry: readonly BetaFeature[] = BETA_FEATURES
): { beta?: string[] } {
  const notes = betaNotes(diagram, registry)
  return notes.length > 0 ? { beta: notes } : {}
}

// The betas whose review date has passed on `today`: each has to be deleted, postponed or
// promoted, so a test fails while there are any.
export function overdueBetas(
  registry: readonly BetaFeature[],
  today: Date
): readonly BetaFeature[] {
  const day = today.toISOString().slice(0, 10)
  return registry.filter((f) => f.reviewBy < day)
}

// What is wrong with the registry itself: a duplicate id, a date that is not YYYY-MM-DD, a kind
// two features both claim.
export function registryProblems(registry: readonly BetaFeature[]): string[] {
  const problems: string[] = []
  const ids = new Set<string>()
  const kinds = new Map<string, string>()
  for (const f of registry) {
    if (ids.has(f.id)) problems.push(`the id "${f.id}" is used twice`)
    ids.add(f.id)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(f.reviewBy) || Number.isNaN(Date.parse(f.reviewBy))) {
      problems.push(`"${f.id}": reviewBy "${f.reviewBy}" is not a date (YYYY-MM-DD)`)
    }
    for (const kind of f.kinds ?? []) {
      const other = kinds.get(kind)
      if (other !== undefined)
        problems.push(`the kind "${kind}" is in both "${other}" and "${f.id}"`)
      kinds.set(kind, f.id)
    }
  }
  return problems
}

// The names the hand-written spec has to mark "(beta)" for a feature: its kinds, or its label for
// a feature that adds a field or an operation.
export function betaSpecNames(feature: BetaFeature): readonly string[] {
  return feature.kinds && feature.kinds.length > 0 ? feature.kinds : [feature.label]
}

// The betas whose names a spec text does not mark: a line that names it must also say "(beta)".
export function unmarkedBetas(registry: readonly BetaFeature[], specText: string): string[] {
  const lines = specText.split(/\r?\n/)
  const missing: string[] = []
  for (const feature of registry) {
    for (const name of betaSpecNames(feature)) {
      if (!lines.some((line) => line.includes(name) && line.includes('(beta)'))) {
        missing.push(`${feature.id}: ${name}`)
      }
    }
  }
  return missing
}
