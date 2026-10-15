// Run with `npm test`. Covers the parsing of the installer's install-options.json
// (ADR 0108); where the file is read from and when it seeds is main-process glue.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseInstallOptions } from './installOptions.ts'

test('reads the AI-features choice in either direction', () => {
  assert.deepEqual(parseInstallOptions('{ "aiFeaturesEnabled": false }'), { aiFeaturesEnabled: false })
  assert.deepEqual(parseInstallOptions('{ "aiFeaturesEnabled": true }'), { aiFeaturesEnabled: true })
})

test('tolerates the CRLF line ending the installer writes', () => {
  assert.deepEqual(parseInstallOptions('{ "aiFeaturesEnabled": false }\r\n'), {
    aiFeaturesEnabled: false
  })
})

test('ignores unknown fields and wrongly typed values', () => {
  assert.deepEqual(parseInstallOptions('{ "aiFeaturesEnabled": "no", "recentDiagramsLimit": 1 }'), {})
  assert.deepEqual(parseInstallOptions('{ "somethingElse": true }'), {})
})

test('malformed, empty or non-object input means no options', () => {
  for (const raw of ['', '{', 'null', '[]', '"text"', '42']) {
    assert.deepEqual(parseInstallOptions(raw), {}, raw)
  }
})
