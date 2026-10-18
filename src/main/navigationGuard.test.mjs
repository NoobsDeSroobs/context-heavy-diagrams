// Run with `npm test`. Covers the URL checks behind the window navigation
// guard (ADR 0112); the Electron wiring around them is exercised in the app.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isSafeExternalUrl, isSameDocument } from './navigationGuard.ts'

test('allows http, https and mailto links to open externally', () => {
  assert.equal(isSafeExternalUrl('https://example.org/page?x=1'), true)
  assert.equal(isSafeExternalUrl('http://example.org'), true)
  assert.equal(isSafeExternalUrl('mailto:someone@example.org'), true)
})

test('refuses protocols that can reach local programs or network shares', () => {
  assert.equal(isSafeExternalUrl('file:///C:/Windows/System32/calc.exe'), false)
  assert.equal(isSafeExternalUrl('smb://server/share'), false)
  assert.equal(isSafeExternalUrl('javascript:alert(1)'), false)
  assert.equal(isSafeExternalUrl('ms-msdt:/id PCWDiagnostic'), false)
})

test('refuses strings that are not URLs at all', () => {
  assert.equal(isSafeExternalUrl('not a url'), false)
  assert.equal(isSafeExternalUrl(''), false)
})

test('the app page with a different query or hash is still the same document', () => {
  const page = 'file:///C:/Program%20Files/App/resources/app.asar/out/renderer/index.html'
  assert.equal(isSameDocument(`${page}?session=abc`, `${page}?path=x.chd`), true)
  assert.equal(isSameDocument(`${page}#frag`, page), true)
  assert.equal(isSameDocument('http://localhost:5173/?session=1', 'http://localhost:5173/'), true)
})

test('another page, host or protocol is a navigation away', () => {
  const page = 'file:///C:/App/out/renderer/index.html?session=abc'
  assert.equal(isSameDocument('https://example.org/', page), false)
  assert.equal(isSameDocument('file:///C:/Users/me/dropped.chd', page), false)
  assert.equal(isSameDocument('http://localhost:5173/', 'http://localhost:9999/'), false)
  assert.equal(isSameDocument('garbage', page), false)
})
