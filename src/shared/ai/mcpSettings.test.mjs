// Run with `npm test` (Node's built-in runner; TypeScript is type-stripped).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { MCP_SERVER_NAME, mcpServerSettings } from './mcpSettings.ts'

const input = {
  command: 'C:\\Apps\\Context-Heavy Diagrams\\context-heavy-diagrams.exe',
  script: 'C:\\Apps\\Context-Heavy Diagrams\\resources\\app.asar.unpacked\\resources\\cli\\chd.mjs',
  folder: 'D:\\diagrams',
  allowUpdate: false
}

test('the settings start the app as Node with chd mcp and the folder', () => {
  const server = JSON.parse(mcpServerSettings(input)).mcpServers[MCP_SERVER_NAME]
  assert.equal(server.command, input.command)
  assert.deepEqual(server.args, [input.script, 'mcp', input.folder])
  assert.deepEqual(server.env, { ELECTRON_RUN_AS_NODE: '1' })
})

test('paths with backslashes and spaces survive the round trip', () => {
  const text = mcpServerSettings(input)
  assert.equal(JSON.parse(text).mcpServers[MCP_SERVER_NAME].command, input.command)
})

test('changing existing files is asked for, never the default', () => {
  const read = JSON.parse(mcpServerSettings(input)).mcpServers[MCP_SERVER_NAME].args
  assert.ok(!read.includes('--allow-update'))
  const write = JSON.parse(mcpServerSettings({ ...input, allowUpdate: true })).mcpServers[
    MCP_SERVER_NAME
  ].args
  assert.equal(write.at(-1), '--allow-update')
})
