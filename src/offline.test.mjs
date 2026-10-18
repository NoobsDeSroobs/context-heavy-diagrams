// Run with `npm test`. A tripwire for ADR 0113: the app makes no network
// requests of its own, so none of the APIs that could make one may appear in
// shipped code. The runtime policy (main/offline.ts) only covers requests from
// windows; this covers the main process, the CLI and the Claude Desktop
// extension, which it cannot see. If this fails because of a deliberate new
// feature, that feature needs its own decision first (and a privacy review).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { join, extname } from 'node:path'

const roots = ['src', 'extension', 'resources/cli']
const codeExtensions = new Set(['.ts', '.tsx', '.mjs', '.js'])

const forbidden = [
  [/(^|[^\w.$])fetch\(/, 'fetch()'],
  [/\bnet\.(request|fetch)\b/, 'Electron net.request / net.fetch'],
  [/\bXMLHttpRequest\b/, 'XMLHttpRequest'],
  [/\bnew\s+WebSocket\b/, 'WebSocket'],
  [/\bnew\s+EventSource\b/, 'EventSource'],
  [/\bsendBeacon\b/, 'navigator.sendBeacon'],
  [/\bautoUpdater\b|electron-updater/, 'an auto-updater'],
  [/\bcrashReporter\b/, 'crashReporter'],
  [/from\s+['"](node:)?(http|https|http2|net|tls|dgram|dns)['"]/, 'a Node networking module'],
  [
    /require\(\s*['"](node:)?(http|https|http2|net|tls|dgram|dns)['"]\s*\)/,
    'a Node networking module'
  ]
]

function* codeFiles(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules') yield* codeFiles(path)
    } else if (codeExtensions.has(extname(entry.name)) && !/\.test\.mjs$/.test(entry.name)) {
      yield path
    }
  }
}

// Comments may legitimately mention these words; only code counts.
function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')
}

test('shipped code contains no network APIs', () => {
  const findings = []
  for (const root of roots) {
    for (const file of codeFiles(root)) {
      const code = stripComments(readFileSync(file, 'utf8'))
      for (const [pattern, what] of forbidden) {
        if (pattern.test(code)) findings.push(`${file}: ${what}`)
      }
    }
  }
  assert.deepEqual(findings, [])
})
