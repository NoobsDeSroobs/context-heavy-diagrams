// Run with `npm test`. `chd mcp` runs the extension's server for any MCP client (ADR 0110, ADR 0138):
// start it the way a client does, over stdio with the MCP SDK's own client, and see that the folder
// and the update setting are the ones given on the command line.
import { test, before } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { SERVER_FILE, bundleServer } from '../../scripts/build-extension.mjs'

const cli = join(import.meta.dirname, '..', '..', 'resources', 'cli', 'chd.mjs')
const VALID = JSON.stringify({ version: 1, nodes: [{ id: 'a' }], edges: [] })

before(async () => {
  await bundleServer(SERVER_FILE)
})

async function withServer(args, run) {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [cli, 'mcp', ...args],
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

test('chd mcp serves the folder it is given, read only unless told otherwise', async () => {
  const folder = mkdtempSync(join(tmpdir(), 'chd-mcp-'))
  try {
    writeFileSync(join(folder, 'a.chd'), VALID)
    await withServer([folder], async (client) => {
      const names = (await client.listTools()).tools.map((t) => t.name)
      assert.ok(names.includes('read_file'))
      assert.ok(!names.includes('update_file'))
      const read = await client.callTool({ name: 'read_file', arguments: { path: 'a.chd' } })
      assert.equal(JSON.parse(read.content[0].text).content, VALID)
    })
    await withServer([folder, '--allow-update'], async (client) => {
      const names = (await client.listTools()).tools.map((t) => t.name)
      assert.ok(names.includes('update_file'))
    })
  } finally {
    rmSync(folder, { recursive: true, force: true })
  }
})

test('the folder may come after the option', async () => {
  const folder = mkdtempSync(join(tmpdir(), 'chd-mcp-'))
  try {
    await withServer(['--allow-update', folder], async (client) => {
      const names = (await client.listTools()).tools.map((t) => t.name)
      assert.ok(names.includes('update_file'))
    })
  } finally {
    rmSync(folder, { recursive: true, force: true })
  }
})

test('chd mcp without a folder is a usage error, and a missing folder is refused', () => {
  const none = spawnSync(process.execPath, [cli, 'mcp'], { encoding: 'utf-8' })
  assert.equal(none.status, 2)
  assert.match(none.stderr, /Usage: chd mcp/)
  const missing = spawnSync(
    process.execPath,
    [cli, 'mcp', join(tmpdir(), 'chd-no-such-folder-x')],
    {
      encoding: 'utf-8'
    }
  )
  assert.equal(missing.status, 1)
  assert.match(missing.stderr, /does not exist/)
})
