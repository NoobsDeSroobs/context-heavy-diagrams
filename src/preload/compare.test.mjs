// Run with `npm test` (Node's built-in runner).
// The compare window has its own, smaller bridge (compare.ts, ADR 0112). This keeps it honest: it
// exposes exactly what the compare window's code can reach, on the same channels as the editor's
// bridge, and nothing that writes.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'

const src = join(import.meta.dirname, '..')
const aliases = {
  '@shared/': join(src, 'shared') + '/',
  '@renderer/': join(src, 'renderer', 'src') + '/'
}
const entry = join(src, 'renderer', 'src', 'compare', 'CompareView.tsx')

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

// Every `window.api.<method>` in the files the compare window's code imports, and every mention of
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
    // A formatter may break the line after `window.api`, so whitespace is allowed around the dot.
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

const compare = methodsOf(join(src, 'preload', 'compare.ts'))
const editor = methodsOf(join(src, 'preload', 'index.ts'))

test('the compare bridge exposes exactly what the compare window can reach', () => {
  const { used, odd, files } = reachable()
  assert.ok(files > 20, 'the import walk found the compare window and what it draws with')
  assert.deepEqual(odd, [], 'window.api is only ever used as window.api.method(...) there')
  assert.deepEqual([...compare.keys()].sort(), [...used].sort())
})

test('each method of the compare bridge uses the channel the editor bridge does', () => {
  for (const [name, channel] of compare) {
    assert.ok(channel, `${name} has a channel`)
    assert.ok(editor.has(name), `${name} is also a method of the editor bridge, or is compare-only`)
    assert.equal(editor.get(name), channel, name)
  }
})

test('nothing that writes, saves, exports, picks a file or opens a diagram is exposed', () => {
  const forbidden = /^(save|write|delete|pick|copy|export|import|create|record|set|update|open)/i
  assert.deepEqual(
    [...compare.keys()].filter((name) => forbidden.test(name)),
    []
  )
  const text = readFileSync(join(src, 'preload', 'compare.ts'), 'utf-8')
  assert.doesNotMatch(text, /webUtils|sendSync|preferences:write|diagram:save/)
})

test('the editor bridge is still the large one', () => {
  assert.ok(editor.size > 40)
  assert.ok(compare.size < 10)
})
