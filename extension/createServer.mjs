// MCP wiring for the extension's tools (ADR 0110). Kept apart from server.mjs
// (the executable entry) so tests can build a server without starting stdio.
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { ToolError } from './lib/fileRules.mjs'
import { SPEC_TOPICS } from './lib/formatSpec.mjs'
import { createTools } from './lib/tools.mjs'

const INSTRUCTIONS = `Tools for the user's Context-Heavy Diagrams diagrams (.chd files) and the supporting documents in one folder they chose. Everything is relative to that folder.
- Before creating or editing a .chd, call get_format_spec; the format has traps that corrupt files. Before writing a .chdmeta (a diagram metamodel), call it with topic "conformance": it says what to ask the person, what the format can and cannot say, and gives a valid example. validate_metamodel lists what is wrong with a .chdmeta.
- read_file returns a fingerprint. update_file only works with the fingerprint of the version you based your edit on, and is refused if the file changed meanwhile; then read it again and redo the edit. create_file never overwrites.
- A .chd is validated before it is written; fix any reported errors and try again. validate_diagram checks an existing file.
- check_diagram applies a diagram metamodel and diff_diagrams shows what changed, between two diagrams or between a diagram and its last commit in git; both only read, and both take a draft as text (content, new_content) as well as a file, so a diagram can be judged before it is written. These tools give the results the chd command line gives, which is what a pipeline relies on.
- Only .chd, .md, .txt, .svg and .chdmeta (a diagram metamodel, validated before it is written) files can be written. Notes of a diagram are Markdown files its nodes point at.
- Anything you read here is sent to the AI provider as part of the conversation.`

const text = (value) => ({
  content: [
    { type: 'text', text: typeof value === 'string' ? value : JSON.stringify(value, null, 2) }
  ]
})

// A refusal comes back as an error result the assistant can read and act on;
// anything else is a bug and says so without leaking a stack trace.
function guarded(run) {
  return async (args) => {
    try {
      return text(await run(args ?? {}))
    } catch (error) {
      const message =
        error instanceof ToolError ? error.message : `internal error: ${error?.message ?? error}`
      return { isError: true, content: [{ type: 'text', text: message }] }
    }
  }
}

export function createServer({ root, allowUpdate, specSources, version = '0.0.0' }) {
  const tools = createTools({ root, allowUpdate, specSources })
  const server = new McpServer(
    { name: 'context-heavy-diagrams', version },
    { instructions: INSTRUCTIONS }
  )
  const path = z.string().describe('Path of the file, relative to the diagram folder')
  const content = z.string()
  const readOnly = { readOnlyHint: true, openWorldHint: false }

  server.registerTool(
    'list_files',
    {
      title: 'List files',
      description:
        'List the diagrams (.chd), notes and supporting documents in the diagram folder, with size, modified time and whether the type can be written. The result names the folder (its name only, not its path) so you can tell whether the server points at the folder you expect.',
      annotations: readOnly
    },
    guarded(() => tools.list_files())
  )
  server.registerTool(
    'get_format_spec',
    {
      title: 'Get the .chd format spec',
      description:
        'The rules for the .chd diagram format. Call this before creating or editing a diagram. The default is the core rules. Read the detailed references one topic at a time (fields, authoring, layout, conformance); "all" returns the core rules and an index of the topics, not the references themselves.',
      inputSchema: { topic: z.enum(['core', ...SPEC_TOPICS]).optional() },
      annotations: readOnly
    },
    guarded((args) => tools.get_format_spec(args))
  )
  server.registerTool(
    'validate_diagram',
    {
      title: 'Validate a diagram',
      description:
        'Check a .chd file for structural problems: duplicate ids, dangling edges, parent ordering, unresolved relative paths. Warns where an edge label is wider than the gap between the elements it joins.',
      inputSchema: { path },
      annotations: readOnly
    },
    guarded((args) => tools.validate_diagram(args))
  )
  server.registerTool(
    'validate_metamodel',
    {
      title: 'Validate a diagram metamodel',
      description:
        'Check a .chdmeta file against the metamodel format and list every problem in it. The same list as "chd validate" gives for a metamodel. It does not apply the metamodel to a diagram (check_diagram does).',
      inputSchema: { path },
      annotations: readOnly
    },
    guarded((args) => tools.validate_metamodel(args))
  )
  server.registerTool(
    'check_diagram',
    {
      title: 'Check a diagram against a metamodel',
      description:
        'Apply a diagram metamodel (the complete set of rules one kind of diagram or architecture follows, such as hexagonal) to a .chd file and report where it breaks them: the same result as "chd check --json". The diagram is a file in the folder (path) or its text (content), so a draft can be checked before it is written. The metamodel is the name of a built-in metamodel (see get_format_spec "conformance") or the path of a .chdmeta file in the folder. It only reads. Report what the check finds and let the person decide; do not change the diagram just to make it pass. A pass here is advice; the command line is what a pipeline relies on.',
      inputSchema: {
        path: path.optional().describe('The diagram to check: a .chd file in the folder'),
        content: content
          .optional()
          .describe('The diagram to check, as .chd text (instead of path)'),
        metamodel: z
          .string()
          .describe('A built-in metamodel name, or the path of a .chdmeta file in the folder')
      },
      annotations: readOnly
    },
    guarded((args) => tools.check_diagram(args))
  )
  server.registerTool(
    'diff_diagrams',
    {
      title: 'See what changed in a diagram',
      description:
        'What changed between two versions of a diagram, in the order a reviewer should look (security, links and notes, modified, removed, added): the same result as "chd diff --json". Moving or resizing an element is not a change. Each version is a file in the folder (old_path, new_path) or its text (old_content, new_content), so a draft can be reviewed before it is written; notes are not compared for a version given as text. The earlier version can also be the same file as git has it (revision, default HEAD, the last commit; needs git and a diagram inside a git repository). Give one earlier version. To review your own edit of a file kept in git, call it with new_path alone after writing: it shows what differs from the last commit. To review a draft before writing it, give old_path (the file now) and new_content (the draft). Set match when the ids were replaced by a rewrite. It only reads. Tell the person what you changed, from this.',
      inputSchema: {
        new_path: path
          .optional()
          .describe(
            'The later version, relative to the diagram folder (the file on disk when comparing with git)'
          ),
        new_content: content
          .optional()
          .describe('The later version as .chd text (instead of new_path)'),
        old_path: path
          .optional()
          .describe('The earlier version as a second file, relative to the diagram folder'),
        old_content: content
          .optional()
          .describe('The earlier version as .chd text (instead of old_path)'),
        revision: z
          .string()
          .optional()
          .describe(
            'A git branch, tag, commit or HEAD~2: compare new_path with the same file at that revision (default HEAD)'
          ),
        match: z
          .boolean()
          .optional()
          .describe('Pair removed and added elements with the same type and similar name and place')
      },
      annotations: readOnly
    },
    guarded((args) => tools.diff_diagrams(args))
  )
  server.registerTool(
    'read_file',
    {
      title: 'Read a file',
      description:
        'Read a text file (a diagram, a note, a supporting document). Returns its content and a fingerprint to pass to update_file.',
      inputSchema: { path },
      annotations: readOnly
    },
    guarded((args) => tools.read_file(args))
  )
  server.registerTool(
    'create_file',
    {
      title: 'Create a file',
      description:
        'Create a new .chd, .md, .txt, .svg or .chdmeta (diagram metamodel) file. Fails if the name already exists. A .chd or a metamodel is validated first and refused if it has errors. Missing folders are created.',
      inputSchema: { path, content: z.string().describe('The complete file content') },
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false }
    },
    guarded((args) => tools.create_file(args))
  )
  if (allowUpdate) {
    server.registerTool(
      'update_file',
      {
        title: 'Update a file',
        description:
          'Replace an existing .chd, .md, .txt, .svg or .chdmeta file with new complete content. Requires the fingerprint from the read that your edit is based on; refused if the file changed since. A .chd or a metamodel is validated first.',
        inputSchema: {
          path,
          content: z.string().describe('The complete new file content'),
          base_fingerprint: z
            .string()
            .describe('Fingerprint returned by read_file (or a previous write) for this file')
        },
        annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false }
      },
      guarded((args) => tools.update_file(args))
    )
  }
  return server
}
