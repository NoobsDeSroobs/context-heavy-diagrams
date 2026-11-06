// MCP wiring for the extension's tools (ADR 0110). Kept apart from server.mjs
// (the executable entry) so tests can build a server without starting stdio.
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { INLINE_IMAGE_TYPES, ToolError } from './lib/fileRules.mjs'
import { SPEC_TOPICS } from './lib/formatSpec.mjs'
import { createTools } from './lib/tools.mjs'

const INSTRUCTIONS = `Tools for the user's Context-Heavy Diagrams diagrams (.chd files) and the supporting documents in one folder they chose. Everything is relative to that folder.
- Before creating or editing a .chd, call get_format_spec; the format has traps that corrupt files. Before writing a .chdmeta (a diagram metamodel), call it with topic "conformance": it says what to ask the person, what the format can and cannot say, and gives a valid example. validate_metamodel lists what is wrong with a .chdmeta.
- read_file returns a fingerprint. update_file only works with the fingerprint of the version you based your edit on, and is refused if the file changed meanwhile; then read it again and redo the edit. create_file never overwrites.
- To build or change a diagram step by step, use edit_diagram: it creates the file if it does not exist, applies a list of operations (add_entity, connect, move, ...) and answers briefly with what each made (ids, places, sizes) and what is wrong with the layout so far, with many problems of one kind collapsed into one line with their number. You decide where everything goes; ask room_for_label how much space two connected elements need before you place them, and pass the fingerprint each answer returns as base_fingerprint in the next call. inspect_diagram lists the elements as they stand. A diagram made this way in this session can be edited again without allowing changes to existing files.
- A .chd is validated before it is written; fix any reported errors and try again. validate_diagram checks an existing file.
- check_diagram applies a diagram metamodel and diff_diagrams shows what changed, between two diagrams or between a diagram and its last commit in git; both only read, and both take a draft as text (content, new_content) as well as a file, so a diagram can be judged before it is written. These tools give the results the chd command line gives, which is what a pipeline relies on.
- Only .chd, .md, .txt, .svg and .chdmeta (a diagram metamodel, validated before it is written) files can be written. Notes of a diagram are Markdown files its nodes point at.
- read_file reads any file in the folder except executables, installers, archives, disk images, video and audio. Text comes back as text; pictures come back as images and other binary files (PDF, spreadsheets) as embedded resources, which you can only use if your client shows them to you. list_files can be narrowed to a subfolder, and search_files finds lines of text across the folder (no shell is needed) so you read only the files and lines you need.
- Anything you read here is sent to the AI provider as part of the conversation.`

// A binary file goes out as an image (the formats clients show as pictures) or as an embedded
// resource, after a text part with its path, type, size and fingerprint.
function binaryContent({ data, ...info }) {
  const uri = `file:///${info.path.split('/').map(encodeURIComponent).join('/')}`
  const part = INLINE_IMAGE_TYPES.has(info.mimeType)
    ? { type: 'image', data, mimeType: info.mimeType }
    : { type: 'resource', resource: { uri, mimeType: info.mimeType, blob: data } }
  return [{ type: 'text', text: JSON.stringify(info, null, 2) }, part]
}

// JSON with one line per key and per item of a list, instead of one per field: the same data in far
// fewer tokens, since a long answer is mostly lists of small objects.
function compactJson(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return JSON.stringify(value)
  }
  const lines = (items, indent) => items.join(`,\n${indent}`)
  const entries = Object.entries(value).map(([key, item]) =>
    Array.isArray(item) && item.length > 0
      ? `${JSON.stringify(key)}: [\n    ${lines(
          item.map((one) => JSON.stringify(one)),
          '    '
        )}\n  ]`
      : `${JSON.stringify(key)}: ${JSON.stringify(item)}`
  )
  return `{\n  ${lines(entries, '  ')}\n}`
}

const text = (value) => ({
  content:
    value && typeof value === 'object' && value.binary === true
      ? binaryContent(value)
      : [{ type: 'text', text: typeof value === 'string' ? value : compactJson(value) }]
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

const OPERATIONS_HELP = `Operations, applied in order and all or nothing. Coordinates are absolute canvas pixels (x, y = top-left corner), even inside a container. An answer is short: the id of each element made or changed, with its absolute place and size after a move, resize or add; an element with no "handles" in an answer has the four default connection points (top, right, bottom, left).
- add_entity {label, x, y, width=120, height=80, parent?, id?, style?}; add_container {label, x, y, width=320, height=180, ...}; add_text {label, x, y, width=120, height=48, ...}. parent is a container's id. id is optional (a short one such as "api" is fine; letters, digits . _ -).
- add_line {points: [{x, y, gravity?}, ...] (at least 2), parent?, id?, style?}: a freeform curved line.
- connect {from, to, label?, fromHandle?, toHandle?, id?, style?}: an edge between two entities or containers. Handles are connection point ids; by default the sides that face each other are used.
- add_connection_point {id, side: top|right|bottom|left, offset: 0..1, pointId?}: another point on a side, for more edges on one side. The answer gives pointId to use as fromHandle or toHandle.
- move {id, x, y}; resize {id, width?, height?}; set_label {id, label} (an element or an edge); set_style {id, style}; reparent {id, parent: id | null} (keeps the element where it is); remove {id} deletes an element or an edge (an element's edges go with it; what was inside a container moves up a level).
- set_edge_points {id, points: [{x, y, gravity?}, ...], routing?}: the points an edge's path is bent through, absolute coordinates, in order from the source end; replaces any it has, [] clears them. They only count when the edge is routed catmullRom (a smooth curve; gravity 0 is a sharp corner) or step/smoothstep (right angles through each point), so pass routing too unless the edge already has one of those; the answer warns if the points would be ignored.
- style fields. Elements: fill, fillOpacity, stroke, strokeOpacity, strokeWidth, textAlign (start|center|end), lineStyle (solid|dashed|dotted), startMarker, endMarker, fontSize, fontColor, fontWeight (normal|bold), fontFamily, fontOpacity. Edges: stroke, strokeOpacity, strokeWidth, lineStyle, startMarker, endMarker, labelPosition (0..1 along the edge), routingStyle (straight|step|smoothstep|catmullRom), animation (flow|pulse), animationSpeed, animationDirection, pulseDistance, dashLength, dashGap and the font fields. Markers: none, arrowOpen, arrowClosed, circle, circleFilled, diamond, diamondFilled, crowsFootOne, crowsFootMany, crowsFootOneOrMany, crowsFootZeroOrOne, crowsFootZeroOrMany. A value of null removes a field. Colours are CSS colours.
- Tags (entities, containers, edges; a value is any JSON value): add_entity, add_container and connect take tags {name: value}; set_tag {id, key, value}; remove_tag {id, key}. set_diagram_tag {key, value} and remove_diagram_tag {key} tag the diagram itself.
- Required tags are a template every entity, container and edge must carry: set_required_tag {key, lock?, allowedValues?: [text], defaultValue?} seeds it on new elements and fills it in on every existing one; lock is lockedEditable (default; the value can be changed within allowedValues, null is always allowed) or lockedStatic (fixed). remove_required_tag {key} keeps each element's value as a free tag.
- Highlights colour the elements whose tag has a value: set_highlight {key, value, color}; remove_highlight {key, value}.
- The legend explains a colour or line style the diagram uses: add_legend_entry {kind: line|entity, label, color?, id?, and for line: lineStyle?, startMarker?, endMarker?, animation?, ...}; set_legend_entry {id, label?, ...fields, null removes one}; remove_legend_entry {id}.
- Links and notes (entities and containers): add_new_linked_diagram {id, name?} links to a new drill-down diagram the way the editor does: the file is named after the element (or name) and goes in a folder named after this diagram, so shop.chd links to shop/Orders.chd, and that file (in shop/) links to Orders/Items.chd, as paths relative to the file that holds the link. The answer gives the path; create it with edit_diagram (no base_fingerprint). Always use this for the diagrams of a hierarchy, never one flat folder. link_to_existing_diagram {id, path} links to a diagram that already exists or is shared, path relative to this diagram (if it does not exist yet the answer warns, and points to add_new_linked_diagram when the path is also outside this diagram's folder); remove_link {id}. set_note {id, text} writes a Markdown note beside the diagram and answers with its path, to read with read_file and change with update_file; it is refused if the element has a note. remove_note {id} removes only the reference, never the file.`

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
        'List the files in the diagram folder (diagrams, notes, supporting documents, source code and so on, except the types that cannot be read), with size, modified time and whether the type can be written. A large folder is listed only up to a cap, flagged as truncated: give a subfolder to list just that part. The result names the folder (its name only, not its path) so you can tell whether the server points at the folder you expect.',
      inputSchema: {
        subfolder: z
          .string()
          .optional()
          .describe('A folder inside the diagram folder to list instead of all of it')
      },
      annotations: readOnly
    },
    guarded((args) => tools.list_files(args))
  )
  server.registerTool(
    'search_files',
    {
      title: 'Search the text of the files',
      description:
        'Find lines of text in the files of the diagram folder, as grep does, with no shell: for an event name, a class, a setting, a word in the documentation. Plain text by default; regex: true for a regular expression (a slow one is cut off). ignore_case, a subfolder, a glob over the path from the folder ("*.ts" for every .ts file, "server/**/*.service.ts"), context (0 to 5 lines around a match) and max_matches narrow or widen it. files_only lists just the files and how many lines match in each, to see where something lives before reading. Matches come back as "path:line: text" (context lines as "path-line- text"), long lines cut around the match; read_file reads the whole file. Skips dot-folders, node_modules, files over 2 MB, binary files and the types that cannot be read; it says when it stopped early.',
      inputSchema: {
        pattern: z.string().describe('The text to find (a regular expression if regex is true)'),
        regex: z.boolean().optional(),
        ignore_case: z.boolean().optional(),
        subfolder: z.string().optional().describe('Search only inside this folder'),
        glob: z.string().optional().describe('Only files whose path matches, such as "*.ts"'),
        context: z.number().int().optional().describe('Lines before and after each match, 0 to 5'),
        max_matches: z.number().int().optional().describe('At most this many matches, default 50'),
        files_only: z.boolean().optional()
      },
      annotations: readOnly
    },
    guarded((args) => tools.search_files(args))
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
        'Check a .chd file for structural problems: duplicate ids, dangling edges, parent ordering, unresolved relative paths. Warns where an edge label does not fit in the gap between the elements it joins, with the line showing either side of it.',
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
    'edit_diagram',
    {
      title: 'Build or change a diagram step by step',
      description:
        'Create a .chd (if the path does not exist) or change one by applying a list of operations, the way a person works: add entities, containers, text and lines, connect them, move, resize, restyle, tag, link, add notes, highlights and legend entries, remove. Everything is placed where you say; nothing is laid out for you. The answer gives, for each operation, the element it made or changed (id, position, size, connection points), a new fingerprint for the next call, and the layout problems found so far (labels without room, overlaps, elements sticking out of their container, edges running over an element). Fix those and carry on. ' +
        OPERATIONS_HELP,
      inputSchema: {
        path: path.describe(
          'The diagram, relative to the diagram folder. It is created if it does not exist.'
        ),
        operations: z
          .array(z.object({ op: z.string().describe('The operation name') }).passthrough())
          .describe('The operations, in order'),
        base_fingerprint: z
          .string()
          .optional()
          .describe(
            'Required for a diagram that exists: the fingerprint from your last edit_diagram or inspect_diagram answer (or read_file). Leave out to create a new diagram.'
          )
      },
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false }
    },
    guarded((args) => tools.edit_diagram(args))
  )
  server.registerTool(
    'inspect_diagram',
    {
      title: 'List the elements of a diagram',
      description:
        'The elements of a .chd as they stand: id, type, label, absolute position and size, parent and connection point ids (left out when they are the four defaults); the edges with their ends; tags, links and note paths; the required tags, highlights and legend; the layout problems found so far (labels without room, overlaps, elements sticking out of a container, edges running over an element); and the fingerprint to pass to edit_diagram. Read-only.',
      inputSchema: { path },
      annotations: readOnly
    },
    guarded((args) => tools.inspect_diagram(args))
  )
  server.registerTool(
    'room_for_label',
    {
      title: 'How much room an edge label needs',
      description:
        'How much clear space, in pixels, two connected elements need between them for an edge with this label: the minimum below which the label hides the line or its end graphic, and a target at which the line reads clearly either side. direction is "horizontal" for elements side by side, "vertical" for one above the other. Give fontSize, bold or fontFamily if the edge sets its own, the end graphics if they are not the default (no start graphic, a closed arrow at the end), and position (0 to 1) if the label is slid towards one end. Use it before placing connected elements.',
      inputSchema: {
        label: z.string(),
        direction: z.enum(['horizontal', 'vertical']),
        fontSize: z.number().optional(),
        bold: z.boolean().optional(),
        fontFamily: z.string().optional(),
        startMarker: z.string().optional(),
        endMarker: z.string().optional(),
        position: z.number().optional()
      },
      annotations: readOnly
    },
    guarded((args) => tools.room_for_label(args))
  )
  server.registerTool(
    'read_file',
    {
      title: 'Read a file',
      description:
        'Read a file in the diagram folder (a diagram, a note, a supporting document, source code, a PDF, a picture). Text returns its content and a fingerprint to pass to update_file; a picture returns as an image and any other binary file as an embedded resource, with its type, size and fingerprint. Executables, installers, archives, disk images, video and audio are refused.',
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
