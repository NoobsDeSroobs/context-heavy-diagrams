// Run with `npm test`. Covers the request rule behind the enforced-offline
// policy (ADR 0113); the Electron wiring around it is exercised in the app.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isRequestAllowed } from './offlinePolicy.ts'

test('allows the app’s own local content', () => {
  assert.equal(isRequestAllowed('file:///C:/App/resources/app.asar/out/renderer/index.html'), true)
  assert.equal(isRequestAllowed('data:image/png;base64,AAAA'), true)
  assert.equal(isRequestAllowed('blob:file:///1234-5678'), true)
  assert.equal(isRequestAllowed('devtools://devtools/bundled/devtools_app.html'), true)
})

test('blocks every network request in a packaged app', () => {
  assert.equal(isRequestAllowed('https://example.org/data.json'), false)
  assert.equal(isRequestAllowed('http://example.org/'), false)
  assert.equal(isRequestAllowed('http://localhost:5173/'), false)
  assert.equal(isRequestAllowed('wss://example.org/socket'), false)
  assert.equal(isRequestAllowed('ftp://example.org/file'), false)
})

test('blocks things that are not URLs', () => {
  assert.equal(isRequestAllowed(''), false)
  assert.equal(isRequestAllowed('not a url'), false)
})

test('in development, allows only the dev server’s own host', () => {
  const dev = 'http://localhost:5173'
  assert.equal(isRequestAllowed('http://localhost:5173/src/main.tsx', dev), true)
  assert.equal(isRequestAllowed('ws://localhost:5173/?token=abc', dev), true)
  assert.equal(isRequestAllowed('http://localhost:9999/', dev), false)
  assert.equal(isRequestAllowed('https://example.org/', dev), false)
  assert.equal(isRequestAllowed('http://localhost.evil.example/', dev), false)
})
