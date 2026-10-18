// Run with `npm test`. Starts the real extension server and talks to it over
// stdio with the MCP SDK's own client, exactly as Claude Desktop does (ADR 0110) —
// once from source and once from the esbuild bundle that ships.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { bundleServer } from '../scripts/build-extension.mjs'

const VALID = JSON.stringify({ version: 1, nodes: [{ id: 'a' }], edges: [] })
const sourceEntry = fileURLToPath(new URL('./server.mjs', import.meta.url))

async function withServer(entry, allowUpdate, folder, run) {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [entry, folder],
    env: { ...process.env, CHD_ALLOW_UPDATE: String(allowUpdate) },
    stderr: 'pipe'
  })
  const client = new Client({ name: 'test-client', version: '1.0.0' })
  await client.connect(transport)
  try {
    await run(client)
  } finally {
    await client.close()
  }
}

const textOf = (result) => result.content[0].text

async function exercise(entry) {
  const folder = mkdtempSync(join(tmpdir(), 'chd-ext-srv-'))
  try {
    writeFileSync(join(folder, 'a.chd'), VALID)

    await withServer(entry, false, folder, async (client) => {
      const names = (await client.listTools()).tools.map((t) => t.name).sort()
      assert.deepEqual(names, [
        'create_file',
        'get_format_spec',
        'list_files',
        'read_file',
        'validate_diagram'
      ])
      const read = JSON.parse(
        textOf(await client.callTool({ name: 'read_file', arguments: { path: 'a.chd' } }))
      )
      assert.equal(read.content, VALID)
      const spec = await client.callTool({ name: 'get_format_spec', arguments: {} })
      assert.match(textOf(spec), /# \.chd diagram format/)
      const refused = await client.callTool({
        name: 'read_file',
        arguments: { path: '../x.md' }
      })
      assert.equal(refused.isError, true)
      const created = await client.callTool({
        name: 'create_file',
        arguments: { path: 'new.chd', content: VALID }
      })
      assert.equal(created.isError ?? false, false)
      assert.equal(readFileSync(join(folder, 'new.chd'), 'utf-8'), VALID)
    })

    await withServer(entry, true, folder, async (client) => {
      const names = (await client.listTools()).tools.map((t) => t.name)
      assert.ok(names.includes('update_file'))
      const stale = await client.callTool({
        name: 'update_file',
        arguments: { path: 'a.chd', content: VALID, base_fingerprint: '0'.repeat(64) }
      })
      assert.equal(stale.isError, true)
      assert.match(textOf(stale), /changed since you read it/)
    })
  } finally {
    rmSync(folder, { recursive: true, force: true })
  }
}

test('the server works over stdio from source: tools, update gating, refusals', async () => {
  await exercise(sourceEntry)
})

test('the bundled server (what ships) behaves the same, with its spec text inlined', async () => {
  const outDir = mkdtempSync(join(tmpdir(), 'chd-ext-bundle-'))
  try {
    const bundle = join(outDir, 'index.mjs')
    await bundleServer(bundle, '9.9.9')
    await exercise(bundle)
  } finally {
    rmSync(outDir, { recursive: true, force: true })
  }
})

test('starting without a folder, or with a missing one, fails cleanly', async () => {
  const { spawnSync } = await import('node:child_process')
  const r = spawnSync(process.execPath, [sourceEntry], { encoding: 'utf-8' })
  assert.equal(r.status, 1)
  assert.match(r.stderr, /no diagram folder/)
  const r2 = spawnSync(process.execPath, [sourceEntry, join(tmpdir(), 'chd-does-not-exist-x')], {
    encoding: 'utf-8'
  })
  assert.equal(r2.status, 1)
  assert.match(r2.stderr, /does not exist/)
})
