// Run with `npm test`. THIRD-PARTY-NOTICES.md is generated from the dependency tree
// (scripts/generate-notices.mjs, ADR 0119): this fails when a dependency was added,
// removed or updated without regenerating it, or when a shipped package has a license
// that is not known to be compatible with GPL-3.0-or-later.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { generate, NOTICES_FILE } from '../../scripts/generate-notices.mjs'

test('third-party notices are current and every shipped license is allowed', async () => {
  const { markdown, problems } = await generate()
  assert.deepEqual(problems, [])
  const committed = readFileSync(NOTICES_FILE, 'utf8').replace(/\r\n/g, '\n')
  assert.ok(committed === markdown, 'THIRD-PARTY-NOTICES.md is out of date: run `npm run notices`')
})
