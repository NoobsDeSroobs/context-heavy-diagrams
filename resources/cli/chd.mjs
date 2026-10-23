#!/usr/bin/env node
// `chd` — the app's command-line companion (ADR 0106). Plain Node, no
// dependencies: the launchers next to the app (build/launchers) run this file
// with the app's own executable in ELECTRON_RUN_AS_NODE mode, so an end user
// needs no separate Node install. It can also be run directly: `node chd.mjs`.
//
// Exit codes: 0 ok, 1 validation errors found, 2 usage error.
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { main as validateMain } from '../ai/skills/chd-diagrams/scripts/validate_chd.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const skillDir = join(here, '..', 'ai', 'skills', 'chd-diagrams')

// What each `chd spec <topic>` prints. The default topic is only the skill
// itself (the core rules) — the references are tens of KB, too much to pour
// into an AI's context unasked, so they are opt-in.
const SPEC_TOPICS = {
  fields: { title: 'Field reference', file: 'references/field-reference.md' },
  authoring: { title: 'Authoring guide', file: 'references/authoring-guide.md' },
  layout: { title: 'Layout guide', file: 'references/layout-guide.md' },
  conformance: { title: 'Architecture checks', file: 'references/conformance.md' }
}

const HELP = `chd — command-line companion to Context Heavy Diagrams

Usage:
  chd spec [fields|authoring|layout|conformance|all] Print the .chd file format reference
  chd validate <file.chd>... [--recursive] Check diagram files for structural problems
  chd hash <file.chd>                      Print the file's fingerprint (SHA-256 of its bytes)
  chd export <file.chd> [options]          Draw the diagram as an SVG image (see 'chd export --help')
  chd check <file.chd>... --profile <p>    Check diagrams against an architecture profile (see 'chd check --help')
  chd --version
  chd --help

If you are an AI assistant: run \`chd spec\` first to learn the .chd format, then
run \`chd validate <file>\` after every edit you make to a diagram. Before you write an
edited file back, run \`chd hash <file>\` again and compare it with the value from when
you read it: if it differs, someone changed the file meanwhile, so re-read it and redo
your edit on the fresh content.

  spec       Default: the core rules and traps. 'fields' is the exact field-by-field
             reference, 'authoring' covers linking/tags/git, 'layout' covers spacing
             and archetypes, 'conformance' covers architecture checks, 'all' prints everything.
  validate   Reports duplicate ids, dangling edge endpoints, parent-before-child
             ordering, and relative paths (icons, notes, linked diagrams) that don't
             resolve. --recursive also follows linked diagrams. Exit code 1 if any
             ERROR was found (warnings alone don't fail).
  hash       Prints the lowercase-hex SHA-256 of the file's raw bytes — the same
             fingerprint the Claude Desktop extension uses (ADR 0109). Exit code 1 if
             the file can't be read.
  export     Writes an .svg next to the diagram (or where -o says), so an image in a README
             or wiki can be regenerated whenever the diagram changes. Needs no display.
             It only reads the diagram. Exit code 1 if the file can't be read or written.
  check      Reports where a diagram breaks the rules of an architectural style (a profile: a
             file, or a built-in such as 'hexagonal'). It only reads the diagram. Exit code 1 if a
             diagram has an error, 2 if the command or the profile can't be used.
`

function readSkillFile(rel) {
  return readFileSync(join(skillDir, ...rel.split('/')), 'utf-8')
}

// The skill file starts with YAML frontmatter meant for skill loaders, not readers.
function stripFrontmatter(text) {
  return text.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '').trimStart()
}

const SPEC_PREAMBLE = `(Output of \`chd spec\`. File links below such as references/field-reference.md are the
topics of the same command (\`chd spec fields\`, \`authoring\`, \`layout\`, \`conformance\`); wherever it says to
run \`node scripts/validate_chd.mjs <file>\`, run \`chd validate <file>\` instead.)

`

function spec(topic) {
  if (topic !== undefined && topic !== 'all' && !(topic in SPEC_TOPICS)) {
    console.error(
      `chd: unknown spec topic '${topic}' (expected fields, authoring, layout, conformance or all)`
    )
    return 2
  }
  const parts = []
  if (topic === undefined || topic === 'all') {
    parts.push(SPEC_PREAMBLE + stripFrontmatter(readSkillFile('SKILL.md')))
  }
  for (const [name, { title, file }] of Object.entries(SPEC_TOPICS)) {
    if (topic === 'all' || topic === name) parts.push(`# ${title}\n\n${readSkillFile(file)}`)
  }
  if (topic === undefined) {
    parts.push(
      'More detail: `chd spec fields`, `chd spec authoring`, `chd spec layout`, `chd spec conformance`, `chd spec all`.'
    )
  }
  console.log(parts.join('\n\n---\n\n').trimEnd())
  return 0
}

// package.json sits two levels up in a source checkout. Packaged, this file
// lives under app.asar.unpacked while package.json stays inside app.asar
// (readable because Electron's node mode patches fs for asar).
function appVersion() {
  const root = join(here, '..', '..')
  const candidates = [
    join(root, 'package.json'),
    join(root.replace('app.asar.unpacked', 'app.asar'), 'package.json')
  ]
  for (const path of candidates) {
    try {
      if (existsSync(path)) return JSON.parse(readFileSync(path, 'utf-8')).version
    } catch {
      // try the next candidate
    }
  }
  return 'unknown'
}

// The stale-edit fingerprint (ADR 0109): SHA-256 of the raw bytes, lowercase hex.
function hash(file) {
  try {
    console.log(createHash('sha256').update(readFileSync(file)).digest('hex'))
    return 0
  } catch (error) {
    console.error(`chd: can't read '${file}': ${error instanceof Error ? error.message : error}`)
    return 1
  }
}

// Tabler's outline icons, the built-in icon set, as they sit in a source checkout or inside the
// packaged app (same two layouts as appVersion above). Null if this install has none.
function builtinIconDir() {
  const root = join(here, '..', '..')
  const tail = ['node_modules', '@tabler', 'icons', 'icons', 'outline']
  const candidates = [
    join(root, ...tail),
    join(root.replace('app.asar.unpacked', 'app.asar'), ...tail)
  ]
  return candidates.find((path) => existsSync(path))
}

// `export` lives in its own bundle (scripts/build-cli.mjs), loaded only when asked for, so the
// other commands stay plain Node with nothing to build.
async function exportCommand(args) {
  if (args.includes('--help') || args.includes('-h')) {
    const { EXPORT_USAGE } = await import('./export.mjs')
    console.log(EXPORT_USAGE)
    return 0
  }
  let bundle
  try {
    bundle = await import('./export.mjs')
  } catch (error) {
    console.error(
      `chd: the export command is not built here (run 'npm run build:cli'): ${error instanceof Error ? error.message : error}`
    )
    return 1
  }
  return bundle.runExport(args, { iconDir: builtinIconDir() })
}

// `check` is bundled the same way as `export`. The built-in profiles sit in resources/profiles,
// next to this folder, in a source checkout and in the packaged app alike.
async function checkCommand(args) {
  let bundle
  try {
    bundle = await import('./check.mjs')
  } catch (error) {
    console.error(
      `chd: the check command is not built here (run 'npm run build:cli'): ${error instanceof Error ? error.message : error}`
    )
    return 1
  }
  if (args.includes('--help') || args.includes('-h')) {
    const dir = join(here, '..', 'profiles')
    console.log(bundle.usage({ profilesDir: dir }))
    return 0
  }
  return bundle.runCheck(args, { profilesDir: join(here, '..', 'profiles') })
}

export async function run(argv) {
  const [command, ...rest] = argv
  switch (command) {
    case undefined:
    case '--help':
    case '-h':
    case 'help':
      console.log(HELP)
      return command === undefined ? 2 : 0
    case '--version':
    case '-v':
      console.log(appVersion())
      return 0
    case 'spec':
      return spec(rest[0])
    case 'validate':
      if (rest.filter((a) => !a.startsWith('--')).length === 0) {
        console.error('Usage: chd validate <file.chd>... [--recursive]')
        return 2
      }
      return validateMain(rest)
    case 'hash':
      if (rest.length !== 1) {
        console.error('Usage: chd hash <file.chd>')
        return 2
      }
      return hash(rest[0])
    case 'export':
      return exportCommand(rest)
    case 'check':
      return checkCommand(rest)
    default:
      console.error(`chd: unknown command '${command}'. Run 'chd --help'.`)
      return 2
  }
}

// Only when executed directly, so tests can import `run`.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = await run(process.argv.slice(2))
}
