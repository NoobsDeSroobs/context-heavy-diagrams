import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { basename, join, resolve } from 'node:path'
import type { CheckResult } from '../shared/conformance/check.ts'
import {
  checkDiagramText,
  formatCheckText,
  metamodelProblems,
  parseMetamodelText
} from '../shared/conformance/report.ts'
import type { Metamodel } from '../shared/conformance/metamodel.ts'
import { readStdin, STDIN, STDIN_LABEL } from './stdin.ts'

// `chd check` (ADR 0131): diagrams against a diagram metamodel, for CI and for an AI assistant.
// Bundled into resources/cli/check.mjs by scripts/build-cli.mjs; chd.mjs loads it only for this
// command. Read-only on the diagram, so the stale-edit rule (ADR 0109) does not apply.
//
// Exit codes: 0 every diagram conforms, 1 a diagram has an error (or cannot be read), 2 a usage
// error or a metamodel that cannot be used, so a CI job can tell a failing diagram from a broken setup.

export const CHECK_USAGE = `Usage: chd check <file.chd>... --metamodel <metamodel> [options]

  <file.chd>                A diagram. A single - reads the diagram from standard input, to check
                            a draft before it is written.
  --metamodel <metamodel>   A metamodel file (.chdmeta), or the name of a built-in metamodel
                            (--profile is the old name for this option and still works)
  --json                    Print the result as JSON instead of text

Built-in metamodels: {BUILT_INS}

Reports where a diagram breaks the rules of its diagram metamodel. It only reads the diagram.
Errors fail the check; warnings and information are listed but do not.

Exit codes: 0 every diagram conforms, 1 a diagram has an error or cannot be read, 2 the command or
the metamodel cannot be used.
`

// The text `chd check --help` prints, with the built-in metamodels of this install filled in.
export function usage(env: CheckEnv = {}): string {
  return CHECK_USAGE.replace('{BUILT_INS}', builtInNames(env.metamodelsDir).join(', ') || 'none')
}

export interface CheckEnv {
  // Folder of the built-in metamodels (resources/metamodels), if this install has them.
  metamodelsDir?: string
}

const METAMODEL_SUFFIX = '.chdmeta'

class UsageError extends Error {}

interface Parsed {
  inputs: string[]
  metamodel: string
  json: boolean
}

function parseArgs(args: string[]): Parsed {
  const parsed: Parsed = { inputs: [], metamodel: '', json: false }
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i]
    // --profile is what this option was called before the rename.
    if (arg === '--metamodel' || arg === '--profile') {
      if (i + 1 >= args.length) throw new UsageError(`${arg} needs a value`)
      parsed.metamodel = args[i + 1]
      i += 1
    } else if (arg === '--json') {
      parsed.json = true
    } else if (arg.startsWith('-') && arg !== STDIN) {
      throw new UsageError(`unknown option '${arg}'`)
    } else {
      parsed.inputs.push(arg)
    }
  }
  if (parsed.inputs.length === 0) throw new UsageError('no diagram file given')
  if (parsed.metamodel === '') throw new UsageError('no --metamodel given')
  if (parsed.inputs.filter((f) => f === STDIN).length > 1) {
    throw new UsageError('standard input (-) can be read once')
  }
  return parsed
}

function builtInNames(dir: string | undefined): string[] {
  if (!dir || !existsSync(dir)) return []
  return readdirSync(dir)
    .filter((f) => f.endsWith(METAMODEL_SUFFIX) && f !== `template${METAMODEL_SUFFIX}`)
    .map((f) => f.slice(0, -METAMODEL_SUFFIX.length))
    .sort()
}

// A file that exists wins; otherwise the text names a built-in metamodel.
function metamodelPath(value: string, env: CheckEnv): string {
  const asFile = resolve(value)
  if (existsSync(asFile) && statSync(asFile).isFile()) return asFile
  const names = builtInNames(env.metamodelsDir)
  if (env.metamodelsDir && names.includes(value))
    return join(env.metamodelsDir, value + METAMODEL_SUFFIX)
  throw new UsageError(
    `no metamodel file or built-in metamodel called '${value}'` +
      (names.length > 0 ? ` (built-in: ${names.join(', ')})` : '')
  )
}

function loadMetamodel(value: string, env: CheckEnv): Metamodel {
  const path = metamodelPath(value, env)
  let text: string
  try {
    text = readFileSync(path, 'utf-8')
  } catch (error) {
    throw new UsageError(
      `can't read the metamodel '${basename(path)}': ${error instanceof Error ? error.message : error}`
    )
  }
  const parsed = parseMetamodelText(text, basename(path))
  if ('message' in parsed) throw new UsageError(parsed.message)
  return parsed.metamodel
}

// `chd validate` for metamodel files: the same lines as for a diagram, so a pipeline reads both alike
// (`[file] OK`, or one `ERROR` line for each problem). Exit 1 if any file has a problem.
export function runValidateMetamodels(files: string[]): number {
  let status = 0
  for (const file of files) {
    let problems: string[]
    try {
      problems = metamodelProblems(readFileSync(resolve(file), 'utf-8'))
    } catch (error) {
      problems = [`can't read the file: ${error instanceof Error ? error.message : error}`]
    }
    if (problems.length === 0) {
      console.log(`[${file}] OK`)
    } else {
      for (const problem of problems) console.log(`ERROR   ${problem}`)
      status = 1
    }
  }
  return status
}

export function runCheck(args: string[], env: CheckEnv = {}): number {
  let parsed: Parsed
  let metamodel: Metamodel
  try {
    parsed = parseArgs(args)
    metamodel = loadMetamodel(parsed.metamodel, env)
  } catch (error) {
    if (!(error instanceof UsageError)) throw error
    console.error(`chd: ${error.message}\n\n${usage(env)}`)
    return 2
  }

  let status = 0
  const out: { file: string; result?: CheckResult; error?: string }[] = []
  for (const file of parsed.inputs) {
    const shown = file === STDIN ? STDIN_LABEL : file
    try {
      const text = file === STDIN ? readStdin() : readFileSync(resolve(file), 'utf-8')
      const result = checkDiagramText(text, metamodel)
      out.push({ file: shown, result })
      if (!result.conforms) status = 1
    } catch (error) {
      out.push({ file: shown, error: error instanceof Error ? error.message : String(error) })
      status = 1
    }
  }

  if (parsed.json) {
    console.log(JSON.stringify(out, null, 2))
  } else {
    for (const { file, result, error } of out) {
      if (result) console.log(formatCheckText(file, result))
      else console.error(`chd: can't read '${file}': ${error}`)
    }
  }
  return status
}
