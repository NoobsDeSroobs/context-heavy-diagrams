import { parseDiagram } from '../diagram/index.ts'
import { checkDiagram, type CheckResult } from './check.ts'
import { validateProfile } from './validate.ts'
import type { Profile, Severity } from './profile.ts'

// A conformance check of a diagram as text or JSON, with no file or process in it. `chd check` and
// the MCP server's `check_diagram` both call this (ADR 0138), so they cannot give different
// answers for the same diagram and profile: each only reads its inputs and passes them in.

// A profile from its JSON text. `name` is what the message calls the file. A profile that cannot be
// used is a message, never a partial profile: it checks nothing (ADR 0131).
export function parseProfileText(
  text: string,
  name: string
): { profile: Profile } | { message: string } {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch (error) {
    return {
      message: `can't read the profile '${name}': ${error instanceof Error ? error.message : error}`
    }
  }
  const { profile, errors } = validateProfile(raw)
  if (!profile) {
    return {
      message: `the profile '${name}' is not valid:\n${errors.map((e) => `  ${e}`).join('\n')}`
    }
  }
  return { profile }
}

// Throws if the text is not a diagram.
export function checkDiagramText(text: string, profile: Profile): CheckResult {
  return checkDiagram(parseDiagram(text), profile)
}

const SEVERITY_ORDER: Severity[] = ['error', 'warning', 'info']

function counts(result: CheckResult): string {
  const parts = SEVERITY_ORDER.map((severity) => {
    const n = result.findings.filter((f) => f.severity === severity).length
    return `${n} ${severity === 'info' ? 'info' : severity + (n === 1 ? '' : 's')}`
  })
  return parts.join(', ')
}

export function formatCheckText(file: string, result: CheckResult): string {
  const lines = [
    `${file}: ${result.conforms ? 'conforms' : 'does not conform'} to ${result.profileName} (${counts(result)})`
  ]
  const sorted = [...result.findings].sort(
    (a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity)
  )
  for (const f of sorted) {
    lines.push(
      `  ${f.severity.padEnd(7)} ${f.ruleId}: ${f.message}${f.detail ? ` [${f.detail}]` : ''}`
    )
  }
  if (result.notEvaluated.length > 0) {
    lines.push(`  not evaluated (they need the edge set): ${result.notEvaluated.join(', ')}`)
  }
  return lines.join('\n')
}
