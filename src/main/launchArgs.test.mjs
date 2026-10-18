// Run with `npm test`. Covers the command-line parsing behind double-click to
// open (ADR 0108); the window handling around it is exercised in the app.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { resolve } from 'node:path'
import { diagramPathsFromArgs } from './launchArgs.ts'

const cwd = resolve('work', 'dir')
const abs = (...parts) => resolve('abs', ...parts)

test('keeps only .chd arguments, ignoring the executable, switches and other files', () => {
  const exe = resolve('app', 'context-heavy-diagrams.exe')
  const args = [
    exe,
    '--allow-file-access-from-files',
    abs('a.chd'),
    abs('notes.txt'),
    '--flag=x.chd'
  ]
  assert.deepEqual(diagramPathsFromArgs(args, cwd), [abs('a.chd')])
})

test('matches the extension case-insensitively', () => {
  assert.deepEqual(diagramPathsFromArgs([abs('Upper.CHD')], cwd), [abs('Upper.CHD')])
})

test('resolves a relative path against the given working directory', () => {
  assert.deepEqual(diagramPathsFromArgs(['sub/rel.chd'], cwd), [resolve(cwd, 'sub', 'rel.chd')])
})

test('keeps absolute paths unchanged, including spaces and non-ASCII characters', () => {
  const path = abs('My diagrams', 'Übersicht ✓.chd')
  assert.deepEqual(diagramPathsFromArgs([path], cwd), [path])
})

test('drops exact duplicates but keeps several different files in order', () => {
  const args = [abs('a.chd'), abs('b.chd'), abs('a.chd')]
  assert.deepEqual(diagramPathsFromArgs(args, cwd), [abs('a.chd'), abs('b.chd')])
})

test('an empty or unrelated command line yields nothing', () => {
  assert.deepEqual(diagramPathsFromArgs([], cwd), [])
  assert.deepEqual(diagramPathsFromArgs(['--inspect', '.'], cwd), [])
})
