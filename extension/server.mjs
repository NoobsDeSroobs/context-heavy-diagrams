// Entry point of the Claude Desktop extension (ADR 0110). Claude Desktop starts
// this as `node server/index.mjs <folder>` with CHD_ALLOW_UPDATE set from the
// extension's settings; it speaks MCP over stdio, so nothing may be written to
// stdout except by the protocol — errors go to stderr.
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { createServer } from './createServer.mjs'
import { ToolError, openFolder } from './lib/fileRules.mjs'
import { loadSpecSources } from './lib/specText.mjs'

// Replaced with the app's version by the extension build.
const VERSION = process.env.CHD_EXTENSION_VERSION ?? '0.0.0'

try {
  const root = openFolder(process.argv[2])
  const server = createServer({
    root,
    allowUpdate: process.env.CHD_ALLOW_UPDATE === 'true',
    specSources: loadSpecSources(),
    version: VERSION
  })
  await server.connect(new StdioServerTransport())
} catch (error) {
  console.error(error instanceof ToolError ? `context-heavy-diagrams: ${error.message}` : error)
  process.exit(1)
}
