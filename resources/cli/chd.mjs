#!/usr/bin/env node
// `chd` — the app's command-line companion (ADR 0106). Plain Node, no
// dependencies: the launchers next to the app (build/launchers) run this file
// with the app's own executable in ELECTRON_RUN_AS_NODE mode, so an end user
// needs no separate Node install. It can also be run directly: `node chd.mjs`.
//
// Exit codes: 0 ok, 1 validation errors found, 2 usage error.
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
  layout: { title: 'Layout guide', file: 'references/layout-guide.md' }
}

const HELP = `chd — command-line companion to the Context-Heavy Diagram Tool

Usage:
  chd spec [fields|authoring|layout|all]   Print the .chd file format reference
  chd validate <file.chd>... [--recursive] Check diagram files for structural problems
  chd --version
  chd --help

If you are an AI assistant: run \`chd spec\` first to learn the .chd format, then
run \`chd validate <file>\` after every edit you make to a diagram.

  spec       Default: the core rules and traps. 'fields' is the exact field-by-field
             reference, 'authoring' covers linking/tags/git, 'layout' covers spacing
             and archetypes, 'all' prints everything.
  validate   Reports duplicate ids, dangling edge endpoints, parent-before-child
             ordering, and relative paths (icons, notes, linked diagrams) that don't
             resolve. --recursive also follows linked diagrams. Exit code 1 if any
             ERROR was found (warnings alone don't fail).
`

function readSkillFile(rel) {
  return readFileSync(join(skillDir, ...rel.split('/')), 'utf-8')
}

// The skill file starts with YAML frontmatter meant for skill loaders, not readers.
function stripFrontmatter(text) {
  return text.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '').trimStart()
}

const SPEC_PREAMBLE = `(Output of \`chd spec\`. File links below such as references/field-reference.md are the
topics of the same command (\`chd spec fields\`, \`authoring\`, \`layout\`); wherever it says to
run \`node scripts/validate_chd.mjs <file>\`, run \`chd validate <file>\` instead.)

`

function spec(topic) {
  if (topic !== undefined && topic !== 'all' && !(topic in SPEC_TOPICS)) {
    console.error(`chd: unknown spec topic '${topic}' (expected fields, authoring, layout or all)`)
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
      'More detail: `chd spec fields`, `chd spec authoring`, `chd spec layout`, `chd spec all`.'
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

export function run(argv) {
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
    default:
      console.error(`chd: unknown command '${command}'. Run 'chd --help'.`)
      return 2
  }
}

// Only when executed directly, so tests can import `run`.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = run(process.argv.slice(2))
}
