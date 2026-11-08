// The settings an MCP client needs to start the app's server (ADR 0110): AI -> Install the MCP
// server for -> Other apps. The `mcpServers` form is the one most clients read (Claude Code's
// .mcp.json, Cursor, Claude Desktop's config, Windsurf); a client with another layout takes the
// same command, arguments and environment.
//
// The command is the app's own executable run as plain Node, with the `chd` script, rather than the
// `chd` launcher: a client starts a program without a shell, and a Windows .cmd file needs one.
export const MCP_SERVER_NAME = 'context-heavy-diagrams'

export interface McpSettingsInput {
  // The app's executable.
  command: string
  // resources/cli/chd.mjs, as it can be read from outside the app's archive.
  script: string
  // The one folder the server may reach.
  folder: string
  allowUpdate: boolean
}

export function mcpServerSettings(input: McpSettingsInput): string {
  const args = [input.script, 'mcp', input.folder]
  if (input.allowUpdate) args.push('--allow-update')
  return JSON.stringify(
    {
      mcpServers: {
        [MCP_SERVER_NAME]: {
          command: input.command,
          args,
          env: { ELECTRON_RUN_AS_NODE: '1' }
        }
      }
    },
    null,
    2
  )
}
