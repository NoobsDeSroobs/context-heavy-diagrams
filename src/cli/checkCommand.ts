import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { basename, join, resolve } from 'node:path'
import { parseDiagram } from '../shared/diagram/index.ts'
import { checkDiagram, type CheckResult } from '../shared/conformance/check.ts'
import { validateProfile } from '../shared/conformance/validate.ts'
import type { Profile, Severity } from '../shared/conformance/profile.ts'

// `chd check` (ADR 0131): diagrams against a conformance profile, for CI and for an AI assistant.
// Bundled into resources/cli/check.mjs by scripts/build-cli.mjs; chd.mjs loads it only for this
// command. Read-only on the diagram, so the stale-edit rule (ADR 0109) does not apply.
//
// Exit codes: 0 every diagram conforms, 1 a diagram has an error (or cannot be read), 2 a usage
// error or a profile that cannot be used, so a CI job can tell a failing diagram from a broken setup.

export const CHECK_USAGE = `Usage: chd check <file.chd>... --profile <profile> [options]

  --profile <profile>   A profile file (.chdprofile.json), or the name of a built-in profile
  --json                Print the result as JSON instead of text

Built-in profiles: {BUILT_INS}

Reports where a diagram breaks the rules of an architectural style. Errors make the exit code 1;
warnings and information are listed but do not. Exit code 2 means the command or the profile
could not be used.
`

// The text `chd check --help` prints, with the built-in profiles of this install filled in.
export function usage(env: CheckEnv = {}): string {
  return CHECK_USAGE.replace('{BUILT_INS}', builtInNames(env.profilesDir).join(', ') || 'none')
}

export interface CheckEnv {
  // Folder of the built-in profiles (resources/profiles), if this install has them.
  profilesDir?: string
}

const PROFILE_SUFFIX = '.chdprofile.json'

class UsageError extends Error {}

interface Parsed {
  inputs: string[]
  profile: string
  json: boolean
}

function parseArgs(args: string[]): Parsed {
  const parsed: Parsed = { inputs: [], profile: '', json: false }
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i]
    if (arg === '--profile') {
      if (i + 1 >= args.length) throw new UsageError('--profile needs a value')
      parsed.profile = args[i + 1]
      i += 1
    } else if (arg === '--json') {
      parsed.json = true
    } else if (arg.startsWith('-')) {
      throw new UsageError(`unknown option '${arg}'`)
    } else {
      parsed.inputs.push(arg)
    }
  }
  if (parsed.inputs.length === 0) throw new UsageError('no diagram file given')
  if (parsed.profile === '') throw new UsageError('no --profile given')
  return parsed
}

function builtInNames(dir: string | undefined): string[] {
  if (!dir || !existsSync(dir)) return []
  return readdirSync(dir)
    .filter((f) => f.endsWith(PROFILE_SUFFIX) && f !== `template${PROFILE_SUFFIX}`)
    .map((f) => f.slice(0, -PROFILE_SUFFIX.length))
    .sort()
}

// A file that exists wins; otherwise the text names a built-in profile.
function profilePath(value: string, env: CheckEnv): string {
  const asFile = resolve(value)
  if (existsSync(asFile) && statSync(asFile).isFile()) return asFile
  const names = builtInNames(env.profilesDir)
  if (env.profilesDir && names.includes(value)) return join(env.profilesDir, value + PROFILE_SUFFIX)
  throw new UsageError(
    `no profile file or built-in profile called '${value}'` +
      (names.length > 0 ? ` (built-in: ${names.join(', ')})` : '')
  )
}

function loadProfile(value: string, env: CheckEnv): Profile {
  const path = profilePath(value, env)
  let raw: unknown
  try {
    raw = JSON.parse(readFileSync(path, 'utf-8'))
  } catch (error) {
    throw new UsageError(
      `can't read the profile '${basename(path)}': ${error instanceof Error ? error.message : error}`
    )
  }
  const { profile, errors } = validateProfile(raw)
  if (!profile) {
    throw new UsageError(
      `the profile '${basename(path)}' is not valid:\n${errors.map((e) => `  ${e}`).join('\n')}`
    )
  }
  return profile
}

const SEVERITY_ORDER: Severity[] = ['error', 'warning', 'info']

function counts(result: CheckResult): string {
  const parts = SEVERITY_ORDER.map((severity) => {
    const n = result.findings.filter((f) => f.severity === severity).length
    return `${n} ${severity === 'info' ? 'info' : severity + (n === 1 ? '' : 's')}`
  })
  return parts.join(', ')
}

function formatText(file: string, result: CheckResult): string {
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

export function runCheck(args: string[], env: CheckEnv = {}): number {
  let parsed: Parsed
  let profile: Profile
  try {
    parsed = parseArgs(args)
    profile = loadProfile(parsed.profile, env)
  } catch (error) {
    if (!(error instanceof UsageError)) throw error
    console.error(`chd: ${error.message}\n\n${usage(env)}`)
    return 2
  }

  let status = 0
  const out: { file: string; result?: CheckResult; error?: string }[] = []
  for (const file of parsed.inputs) {
    try {
      const diagram = parseDiagram(readFileSync(resolve(file), 'utf-8'))
      const result = checkDiagram(diagram, profile)
      out.push({ file, result })
      if (!result.conforms) status = 1
    } catch (error) {
      out.push({ file, error: error instanceof Error ? error.message : String(error) })
      status = 1
    }
  }

  if (parsed.json) {
    console.log(JSON.stringify(out, null, 2))
  } else {
    for (const { file, result, error } of out) {
      if (result) console.log(formatText(file, result))
      else console.error(`chd: can't read '${file}': ${error}`)
    }
  }
  return status
}
