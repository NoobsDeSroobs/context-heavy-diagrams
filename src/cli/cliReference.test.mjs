// Run with `npm test`. docs/cli-reference.md is the page people keep open, so it must not fall behind
// the command line: every command, every option in a command's help and every edit operation has to
// appear in it. A new option cannot ship undocumented.
import { test, before } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { bundleCheck, bundleDiff, bundleEdit, bundleExport } from '../../scripts/build-cli.mjs'
import { OPERATIONS_HELP } from '../shared/edit/help.ts'
import { OPERATION_NAMES } from '../shared/edit/operations.ts'

const root = join(import.meta.dirname, '..', '..')
const cli = join(root, 'resources', 'cli', 'chd.mjs')
const sheet = readFileSync(join(root, 'docs', 'cli-reference.md'), 'utf-8').replace(/\r\n/g, '\n')

const chd = (...args) => {
  const result = spawnSync(process.execPath, [cli, ...args], { encoding: 'utf-8' })
  assert.equal(result.status, 0, `chd ${args.join(' ')} said: ${result.stderr}`)
  return result.stdout
}

// The commands as `chd --help` lists them.
const overview = () =>
  [...chd('--help').matchAll(/^ {2}chd ([a-z]+) /gm)].map((m) => m[1]).filter((c) => c !== 'help')

// The part of the sheet under "## `chd <command>`", up to the next section.
const section = (command) => {
  const start = sheet.indexOf(`\n## \`chd ${command}\``)
  assert.notEqual(start, -1, `docs/cli-reference.md has no section for chd ${command}`)
  const end = sheet.indexOf('\n## ', start + 1)
  return sheet.slice(start, end === -1 ? undefined : end)
}

before(async () => {
  await Promise.all([bundleExport(), bundleCheck(), bundleDiff(), bundleEdit()])
})

test('every command has a section in the reference sheet', () => {
  const commands = overview()
  assert.ok(commands.length >= 8, `found only ${commands.join(', ')}`)
  for (const command of commands) section(command)
})

test('every option in a command’s help is in its section', () => {
  for (const command of overview()) {
    const options = new Set(
      [...chd('help', command).matchAll(/(?<![\w-])--[a-z][a-z-]*/g)].map((m) => m[0])
    )
    options.delete('--help')
    const text = section(command)
    for (const option of options) {
      assert.ok(text.includes(option), `chd ${command} has ${option}, the sheet does not say so`)
    }
  }
})

test('every edit operation is in the sheet and in the operations help', () => {
  for (const name of OPERATION_NAMES) {
    assert.ok(section('edit').includes(`\`${name}\``), `the sheet does not list ${name}`)
    assert.ok(OPERATIONS_HELP.includes(name), `chd help edit does not describe ${name}`)
  }
})

test('chd help edit prints the operations, so a command-line user needs no other tool to learn them', () => {
  assert.ok(chd('help', 'edit').includes(OPERATIONS_HELP))
})
