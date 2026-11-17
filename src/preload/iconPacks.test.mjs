// Run with `npm test` (Node's built-in runner).
// The icon pack manager has its own bridge (iconPacks.ts, ADR 0112): the only one that installs and
// removes packs. This keeps it honest: it exposes exactly what the manager's code can reach, shares
// its channels with the editor's bridge where the methods are shared, and the editor's bridge has
// no way to change a pack.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'

const src = join(import.meta.dirname, '..')
const aliases = {
  '@shared/': join(src, 'shared') + '/',
  '@renderer/': join(src, 'renderer', 'src') + '/'
}
const entry = join(src, 'renderer', 'src', 'icons', 'IconPackManager.tsx')

// The methods of an `const api = { ... }` object literal, with the channel each one calls.
function methodsOf(file) {
  const text = readFileSync(file, 'utf-8')
  const body = text.slice(text.indexOf('const api = {'))
  const starts = [...body.matchAll(/^ {2}([A-Za-z]+)\(/gm)]
  const methods = new Map()
  starts.forEach((m, i) => {
    const chunk = body.slice(m.index, starts[i + 1]?.index ?? body.length)
    const channel = chunk.match(/ipcRenderer\.(?:invoke|on|sendSync)\(\s*'([^']+)'/)
    methods.set(m[1], channel ? channel[1] : null)
  })
  return methods
}

function resolveImport(from, spec) {
  let base
  if (spec.startsWith('.')) base = resolve(dirname(from), spec)
  else {
    const alias = Object.keys(aliases).find((a) => spec.startsWith(a))
    if (!alias) return null
    base = aliases[alias] + spec.slice(alias.length)
  }
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, join(base, 'index.ts')]) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate
  }
  return null
}

// Every `window.api.<method>` in the files the manager's code imports, and every mention of
// `window.api` that is not a plain method access (which this cannot follow).
function reachable() {
  const seen = new Set()
  const stack = [entry]
  const used = new Set()
  const odd = []
  while (stack.length > 0) {
    const file = stack.pop()
    if (seen.has(file)) continue
    seen.add(file)
    const text = readFileSync(file, 'utf-8')
    const plain = [...text.matchAll(/window\.api\s*\??\.\s*([A-Za-z]+)/g)]
    for (const m of plain) used.add(m[1])
    const mentions = (text.match(/window\.api\b/g) ?? []).length
    if (mentions !== plain.length) odd.push(file)
    for (const m of text.matchAll(
      /(?:import|export)[^'"]*?from\s+['"]([^'"]+)['"]|import\s+['"]([^'"]+)['"]/g
    )) {
      const spec = m[1] ?? m[2]
      if (!spec || spec.endsWith('.css')) continue
      const target = resolveImport(file, spec)
      if (target) stack.push(target)
    }
  }
  return { used, odd, files: seen.size }
}

const manager = methodsOf(join(src, 'preload', 'iconPacks.ts'))
const editor = methodsOf(join(src, 'preload', 'index.ts'))

test('the manager bridge exposes exactly what the manager can reach', () => {
  const { used, odd, files } = reachable()
  assert.ok(files >= 2, 'the import walk found the manager')
  assert.deepEqual(odd, [], 'window.api is only ever used as window.api.method(...) there')
  assert.deepEqual([...manager.keys()].sort(), [...used].sort())
})

test('a method both bridges have uses the same channel', () => {
  for (const [name, channel] of manager) {
    assert.ok(channel, `${name} has a channel`)
    if (editor.has(name)) assert.equal(editor.get(name), channel, name)
  }
})

test('only the manager can install, cancel or remove a pack', () => {
  const only = [...manager.keys()].filter((name) => !editor.has(name))
  assert.deepEqual(only.sort(), [
    'cancelIconPackInstall',
    'installIconPack',
    'onIconPackProgress',
    'removeIconPack',
    'showIconPacksFolder'
  ])
  const editorChannels = new Set(editor.values())
  for (const name of only) assert.ok(!editorChannels.has(manager.get(name)), name)
})

test('the manager bridge reads and writes nothing but packs', () => {
  const text = readFileSync(join(src, 'preload', 'iconPacks.ts'), 'utf-8')
  assert.doesNotMatch(text, /webUtils|sendSync|preferences:|diagram:|document:/)
  for (const channel of manager.values()) assert.match(channel, /^iconPacks:/)
})
