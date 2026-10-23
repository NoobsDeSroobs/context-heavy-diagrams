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
// into an AI's context unasked, so they are opt-in. `about` is the line
// `chd spec --help` shows; every other list of topics is made from this table.
const SPEC_TOPICS = {
  fields: {
    title: 'Field reference',
    file: 'references/field-reference.md',
    about: 'The exact field-by-field reference.'
  },
  authoring: {
    title: 'Authoring guide',
    file: 'references/authoring-guide.md',
    about: 'Linking diagrams, tags, git.'
  },
  layout: {
    title: 'Layout guide',
    file: 'references/layout-guide.md',
    about: 'Spacing and archetypes for laying a diagram out.'
  },
  conformance: {
    title: 'Architecture checks',
    file: 'references/conformance.md',
    about: 'Checking a diagram against an architecture style (chd check).'
  }
}
const SPEC_TOPIC_NAMES = Object.keys(SPEC_TOPICS)

const HELP = `chd — command-line companion to Context Heavy Diagrams

Usage:
  chd spec [topic]                         Print the .chd file format reference
  chd validate <file.chd>... [--recursive] Check diagram files for structural problems
  chd hash <file.chd>                      Print the file's fingerprint (SHA-256 of its bytes)
  chd export <file.chd> [options]          Draw the diagram as an SVG image
  chd check <file.chd>... --profile <p>    Check diagrams against an architecture profile
  chd help <command>                       Details, options and exit codes of one command
  chd --version
  chd --help

Every command also takes --help.

If you are an AI assistant: run \`chd spec\` first to learn the .chd format, then
run \`chd validate <file>\` after every edit you make to a diagram. Before you write an
edited file back, run \`chd hash <file>\` again and compare it with the value from when
you read it: if it differs, someone changed the file meanwhile, so re-read it and redo
your edit on the fresh content.
`

// The help of the commands implemented in this file. `export` and `check` print their own, from
// their bundles (scripts/build-cli.mjs), next to the code that parses their options.
const COMMAND_HELP = {
  spec: `Usage: chd spec [${SPEC_TOPIC_NAMES.join('|')}|all]

Prints the .chd file format reference, so an assistant can read and write diagrams correctly.

  (no topic)   The core rules and traps. Start here.
${SPEC_TOPIC_NAMES.map((name) => `  ${name.padEnd(12)} ${SPEC_TOPICS[name].about}`).join('\n')}
  all          Everything above.

Exit codes: 0 ok, 2 unknown topic.
`,
  validate: `Usage: chd validate <file.chd>... [--recursive]

Reports duplicate ids, dangling edge endpoints, parent-before-child ordering, and relative paths
(icons, notes, linked diagrams) that don't resolve. Run it after every edit to a diagram.

  --recursive   Also follow linked diagrams

Exit codes: 0 ok (warnings alone don't fail), 1 if any ERROR was found, 2 usage error.
`,
  hash: `Usage: chd hash <file.chd>

Prints the lowercase-hex SHA-256 of the file's raw bytes: the fingerprint for the stale-edit
check, the same one the Claude Desktop extension uses (ADR 0109). Compare it with the value from
when you read the file before you write an edit back.

Exit codes: 0 ok, 1 if the file can't be read, 2 usage error.
`
}
const COMMANDS = ['spec', 'validate', 'hash', 'export', 'check']
const wantsHelp = (args) => args.includes('--help') || args.includes('-h')

function readSkillFile(rel) {
  return readFileSync(join(skillDir, ...rel.split('/')), 'utf-8')
}

// The skill file starts with YAML frontmatter meant for skill loaders, not readers.
function stripFrontmatter(text) {
  return text.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '').trimStart()
}

const SPEC_PREAMBLE = `(Output of \`chd spec\`. File links below such as references/field-reference.md are the
topics of the same command (${SPEC_TOPIC_NAMES.map((name, i) => (i === 0 ? `\`chd spec ${name}\`` : `\`${name}\``)).join(', ')}); wherever it says to
run \`node scripts/validate_chd.mjs <file>\`, run \`chd validate <file>\` instead.)

`

function spec(topic) {
  if (topic !== undefined && topic !== 'all' && !(topic in SPEC_TOPICS)) {
    console.error(
      `chd: unknown spec topic '${topic}' (expected ${SPEC_TOPIC_NAMES.join(', ')} or all)`
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
      `More detail: ${[...SPEC_TOPIC_NAMES, 'all'].map((name) => `\`chd spec ${name}\``).join(', ')}.`
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
  let bundle
  try {
    bundle = await import('./export.mjs')
  } catch (error) {
    console.error(
      `chd: the export command is not built here (run 'npm run build:cli'): ${error instanceof Error ? error.message : error}`
    )
    return 1
  }
  if (wantsHelp(args)) {
    console.log(bundle.EXPORT_USAGE)
    return 0
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
  const env = { profilesDir: join(here, '..', 'profiles') }
  if (wantsHelp(args)) {
    console.log(bundle.usage(env))
    return 0
  }
  return bundle.runCheck(args, env)
}

export async function run(argv) {
  const [command, ...rest] = argv
  switch (command) {
    case undefined:
    case '--help':
    case '-h':
      console.log(HELP)
      return command === undefined ? 2 : 0
    case 'help': {
      // `chd help` is the overview; `chd help <command>` is `chd <command> --help`.
      if (rest.length === 0) {
        console.log(HELP)
        return 0
      }
      if (!COMMANDS.includes(rest[0])) {
        console.error(`chd: no help for '${rest[0]}'. The commands are: ${COMMANDS.join(', ')}.`)
        return 2
      }
      return run([rest[0], '--help'])
    }
    case '--version':
    case '-v':
      console.log(appVersion())
      return 0
    case 'spec':
      if (wantsHelp(rest)) {
        console.log(COMMAND_HELP.spec)
        return 0
      }
      return spec(rest[0])
    case 'validate':
      if (wantsHelp(rest)) {
        console.log(COMMAND_HELP.validate)
        return 0
      }
      if (rest.filter((a) => !a.startsWith('--')).length === 0) {
        console.error('Usage: chd validate <file.chd>... [--recursive]')
        return 2
      }
      return validateMain(rest)
    case 'hash':
      if (wantsHelp(rest)) {
        console.log(COMMAND_HELP.hash)
        return 0
      }
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
