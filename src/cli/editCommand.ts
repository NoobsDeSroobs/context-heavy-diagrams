import { createHash, randomUUID } from 'node:crypto'
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync
} from 'node:fs'
import { dirname, extname, join, posix, relative, resolve, sep } from 'node:path'
import { createEmptyDiagram, parseDiagram, serializeDiagram } from '../shared/diagram/index.ts'
import type { DiagramFile } from '../shared/diagram/index.ts'
import {
  compactJson,
  editIssues,
  foldersFor,
  inspectAnswer,
  MAX_OPERATIONS
} from '../shared/edit/answers.ts'
import { roomForLabel, type RoomQuestion } from '../shared/edit/inspect.ts'
import { OPERATIONS_HELP } from '../shared/edit/help.ts'
import { groupMessages } from '../shared/edit/issues.ts'
import { applyOperations, OperationError } from '../shared/edit/operations.ts'
import { containedPath } from '../main/containedPath.ts'
import { readStdin } from './stdin.ts'

// `chd edit` and `chd ask`: build a diagram step by step, and ask about its layout, from the command
// line, with the same operations and the same answers as the Claude Desktop extension's
// `edit_diagram`, `inspect_diagram` and `room_for_label` (ADR 0138, ADR 0148). Bundled into
// resources/cli/edit.mjs by scripts/build-cli.mjs; chd.mjs loads it only for these commands.
//
// `edit` is an AI write path, so it carries the stale-edit check (ADR 0109): a diagram that exists is
// changed only with the fingerprint of the version the edit was based on, and a create fails if the
// file exists. It works inside the current folder, as the extension works inside its chosen one, and
// a path stored in the diagram (a link, a note) may not lead outside it (ADR 0115).
//
// Exit codes: 0 ok, 1 the edit was not made (an operation was refused, the diagram changed
// meanwhile, the result would be invalid) or the diagram can't be read, 2 a usage error.

export const EDIT_USAGE = `Usage: chd edit <file.chd> [--ops <file>] [--base <fingerprint>]

Applies a list of operations to a diagram and prints what each made (ids, places, sizes), the
fingerprint of the new file and what is wrong with the layout so far, as JSON. The file is created
if it does not exist.

  <file.chd>         A diagram inside the current folder.
  --ops <file>       The operations as JSON: a list of {"op": ..., ...} objects, or {"operations": [...]}.
                     A single - reads them from standard input, which is also the default.
  --base <hash>      Required for a diagram that exists: the fingerprint (chd hash, or the last
                     answer) of the version the edit is based on. The edit is refused if the file
                     changed since. Leave it out to create a new file.

At most ${MAX_OPERATIONS} operations in one call. \`chd spec layout\` has the layout guide for gaps and
sizes. A note or a linked diagram made by an operation is written beside the diagram, in a folder
named after it.

Exit codes: 0 done, 1 not done (an operation was refused, the file changed, the result would be
invalid), 2 usage error.
`

// What `chd edit --help` prints: the usage and the operations. A usage error prints only EDIT_USAGE.
export const EDIT_HELP = `${EDIT_USAGE}
${OPERATIONS_HELP}
`

export const ASK_USAGE = `Usage: chd ask inspect <file.chd> [--styles]
       chd ask room --label <text> --direction horizontal|vertical [options]

Questions about a diagram while you build it. Both only read; the answer is JSON.

  inspect   The elements as they stand, with absolute positions and the connection points an edge may
            name, the tags, links, notes, required tags, highlights and legend, the fingerprint, and
            what is wrong with the layout so far.
              --styles   Also the style fields each element sets
  room      How much space two connected elements need for an edge label.
              --label <text>          The label
              --direction <d>         horizontal (side by side) or vertical (one above the other)
              --font-size <n>  --bold  --font-family <name>
              --start-marker <m>  --end-marker <m>   The graphics at the ends of the edge
              --position <0..1>       How far along the edge the label sits (default the middle)

Exit codes: 0 ok, 1 the diagram can't be read, 2 usage error.
`

class UsageError extends Error {}
class Refused extends Error {}

export interface EditEnv {
  // `validateFile` of the skill's validator script (resources/ai/skills/chd-diagrams/scripts): a path
  // to a .chd and whether to follow linked diagrams, giving its errors and warnings.
  validateFile: (path: string, recursive: boolean) => { errors: string[]; warnings: string[] }
}

const fingerprintOf = (bytes: Buffer): string => createHash('sha256').update(bytes).digest('hex')
const FINGERPRINT = /^[0-9a-f]{64}$/

function valueOf(args: string[], i: number): string {
  if (i + 1 >= args.length) throw new UsageError(`${args[i]} needs a value`)
  return args[i + 1]
}

function numberOf(args: string[], i: number): number {
  const value = Number(valueOf(args, i))
  if (!Number.isFinite(value)) throw new UsageError(`${args[i]} needs a number`)
  return value
}

// --- chd edit

interface EditArgs {
  file: string
  ops: string
  base?: string
}

function parseEditArgs(args: string[]): EditArgs {
  const parsed: EditArgs = { file: '', ops: '-' }
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i]
    if (arg === '--ops') {
      parsed.ops = valueOf(args, i)
      i += 1
    } else if (arg === '--base') {
      parsed.base = valueOf(args, i)
      i += 1
    } else if (arg.startsWith('-')) throw new UsageError(`unknown option '${arg}'`)
    else if (parsed.file === '') parsed.file = arg
    else throw new UsageError(`unexpected argument '${arg}'`)
  }
  if (parsed.file === '') throw new UsageError('no diagram file given')
  if (extname(parsed.file).toLowerCase() !== '.chd')
    throw new UsageError('edit works on .chd files')
  return parsed
}

function operationsFrom(source: string): unknown[] {
  let text: string
  try {
    text = source === '-' ? readStdin() : readFileSync(resolve(source), 'utf-8')
  } catch (error) {
    throw new UsageError(
      `can't read the operations${source === '-' ? ' from standard input' : ` in '${source}'`}: ${error instanceof Error ? error.message : error}`
    )
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch (error) {
    throw new UsageError(`the operations are not valid JSON: ${(error as Error).message}`)
  }
  const list =
    parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as { operations?: unknown }).operations
      : parsed
  if (!Array.isArray(list) || list.length === 0) {
    throw new UsageError('the operations must be a list with at least one operation')
  }
  if (list.length > MAX_OPERATIONS) {
    throw new UsageError(`at most ${MAX_OPERATIONS} operations in one call`)
  }
  return list
}

// Messages carry the temporary file's name and absolute paths: show diagram-relative ones, with "/"
// between the parts of a path on every system.
function tidier(root: string, temp: string, shown: string): (message: string) => string {
  return (message) =>
    message
      .replaceAll(temp, shown)
      .replaceAll(root + sep, '')
      .replaceAll(root, '.')
      .replace(/(?<=[\w.)-])\\(?=[\w.(-])/g, '/')
}

function runEditOnFile(parsed: EditArgs, operations: unknown[], env: EditEnv): unknown {
  const root = process.cwd()
  const absolute = resolve(root, parsed.file)
  const fromRoot = relative(root, absolute).split(sep).join('/')
  if (containedPath(root, fromRoot) === null) {
    throw new Refused(
      `'${parsed.file}' is outside the current folder. chd edit works inside it, so start it in a folder that holds the diagram.`
    )
  }
  const dir = dirname(absolute)
  const exists = existsSync(absolute)
  let diagram: DiagramFile
  if (exists) {
    if (!statSync(absolute).isFile()) throw new Refused(`'${fromRoot}' is not a file`)
    if (parsed.base === undefined || !FINGERPRINT.test(parsed.base)) {
      throw new UsageError(
        `--base is required for a diagram that exists: the fingerprint of the version your edit is based on (chd hash ${fromRoot}, or the last answer).`
      )
    }
    if (fingerprintOf(readFileSync(absolute)) !== parsed.base) throw stale(fromRoot)
    try {
      diagram = parseDiagram(readFileSync(absolute, 'utf-8'))
    } catch (error) {
      throw new Refused(`'${fromRoot}' is not a valid .chd diagram: ${(error as Error).message}`)
    }
  } else {
    if (parsed.base !== undefined) {
      throw new UsageError(
        `'${fromRoot}' does not exist yet, so there is no fingerprint to pass: leave --base out and the diagram is created.`
      )
    }
    diagram = createEmptyDiagram()
  }

  // A path the operations store (a link, a note) is relative to the diagram and must stay inside the
  // folder (ADR 0115).
  const here = posix.dirname(fromRoot)
  const inFolder = (stored: string): string => posix.join(here, stored)
  let applied: ReturnType<typeof applyOperations>
  try {
    applied = applyOperations(diagram, operations, {
      newId: (prefix) => `${prefix}-${randomUUID()}`,
      ...foldersFor(posix.basename(fromRoot, extname(fromRoot))),
      fileExists: (stored) => {
        const full = containedPath(root, inFolder(stored))
        return full !== null && existsSync(full)
      },
      checkReference: (stored) =>
        containedPath(root, inFolder(stored)) === null
          ? `"${stored}" leads outside the current folder`
          : undefined
    })
  } catch (error) {
    if (error instanceof OperationError) {
      throw new Refused(
        `${error.message}. Nothing was changed; fix it and send the whole list again.`
      )
    }
    throw error
  }
  const content = serializeDiagram(applied.diagram)

  // New notes first, each created and never overwritten; if the diagram is then refused (the file
  // changed, an invalid result) the notes made for it are removed again.
  const madeNotes: string[] = []
  const madeDirs: string[] = []
  const temp = join(dir, `.chd-write-${randomUUID()}`)
  try {
    for (const note of applied.files) {
      const target = containedPath(root, inFolder(note.path))
      if (target === null) throw new Refused(`"${note.path}" leads outside the current folder`)
      const firstNew = mkdirSync(dirname(target), { recursive: true })
      if (firstNew) madeDirs.push(firstNew)
      try {
        writeFileSync(target, note.content, { encoding: 'utf-8', flag: 'wx' })
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
          throw new Refused(`the note "${note.path}" already exists, so it was not overwritten`)
        }
        throw error
      }
      madeNotes.push(target)
    }

    // Written beside the target first, so relative paths are checked exactly as they will be and a
    // crash never leaves a half-written diagram.
    const createdDir = exists ? undefined : mkdirSync(dir, { recursive: true })
    if (createdDir) madeDirs.push(createdDir)
    writeFileSync(temp, content, 'utf-8')
    const checked = env.validateFile(temp, false)
    const tidy = tidier(root, temp, fromRoot)
    if (checked.errors.length > 0) {
      throw new Refused(
        `'${fromRoot}' was not written because it has structural errors:\n${checked.errors.map(tidy).join('\n')}`
      )
    }
    if (exists) {
      // Checked again right before replacing; the instant between this and the rename is the one
      // race left (ADR 0110).
      if (fingerprintOf(readFileSync(absolute)) !== parsed.base) throw stale(fromRoot)
      renameSync(temp, absolute)
    } else {
      try {
        writeFileSync(absolute, content, { encoding: 'utf-8', flag: 'wx' })
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
          throw new Refused(`'${fromRoot}' already exists, so it was not overwritten.`)
        }
        throw error
      }
    }
    return {
      path: fromRoot,
      fingerprint: fingerprintOf(readFileSync(absolute)),
      results: applied.results,
      issues: editIssues(applied.diagram),
      warnings: groupMessages(checked.warnings.map(tidy))
    }
  } catch (error) {
    for (const file of madeNotes) rmSync(file, { force: true })
    for (const made of madeDirs) rmSync(made, { recursive: true, force: true })
    throw error
  } finally {
    rmSync(temp, { force: true })
  }
}

const stale = (shown: string): Refused =>
  new Refused(
    `'${shown}' has changed since you read it, so it was not overwritten. Read it again (chd ask inspect, chd hash) and redo your edit on the new content.`
  )

export function runEdit(args: string[], env: EditEnv): number {
  let parsed: EditArgs
  let operations: unknown[]
  try {
    parsed = parseEditArgs(args)
    if (parsed.ops === '-' && process.stdin.isTTY) {
      throw new UsageError('give --ops <file>, or pipe the operations in on standard input')
    }
    operations = operationsFrom(parsed.ops)
    console.log(compactJson(runEditOnFile(parsed, operations, env)))
    return 0
  } catch (error) {
    if (error instanceof UsageError) {
      console.error(`chd: ${error.message}\n\n${EDIT_USAGE}`)
      return 2
    }
    if (error instanceof Refused) {
      console.error(`chd: ${error.message}`)
      return 1
    }
    throw error
  }
}

// --- chd ask

function runInspect(args: string[]): unknown {
  let file = ''
  let styles = false
  for (const arg of args) {
    if (arg === '--styles') styles = true
    else if (arg.startsWith('-')) throw new UsageError(`unknown option '${arg}'`)
    else if (file === '') file = arg
    else throw new UsageError(`unexpected argument '${arg}'`)
  }
  if (file === '') throw new UsageError('no diagram file given')
  let bytes: Buffer
  let diagram: DiagramFile
  try {
    bytes = readFileSync(resolve(file))
    diagram = parseDiagram(bytes.toString('utf-8'))
  } catch (error) {
    throw new Refused(`can't read '${file}': ${error instanceof Error ? error.message : error}`)
  }
  return {
    path: file.split(sep).join('/'),
    fingerprint: fingerprintOf(bytes),
    ...inspectAnswer(diagram, { styles })
  }
}

function runRoom(args: string[]): unknown {
  let label: string | undefined
  let direction: string | undefined
  const question: Partial<RoomQuestion> = {}
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i]
    if (arg === '--label') label = valueOf(args, i)
    else if (arg === '--direction') direction = valueOf(args, i)
    else if (arg === '--font-size') question.fontSize = numberOf(args, i)
    else if (arg === '--font-family') question.fontFamily = valueOf(args, i)
    else if (arg === '--start-marker') question.startMarker = valueOf(args, i)
    else if (arg === '--end-marker') question.endMarker = valueOf(args, i)
    else if (arg === '--position') question.position = numberOf(args, i)
    else if (arg === '--bold') {
      question.bold = true
      continue
    } else throw new UsageError(`unknown option '${arg}'`)
    i += 1
  }
  if (label === undefined) throw new UsageError('--label is required')
  if (direction !== 'horizontal' && direction !== 'vertical') {
    throw new UsageError(
      '--direction must be "horizontal" (side by side) or "vertical" (one above the other)'
    )
  }
  return roomForLabel({ ...question, label, direction })
}

export function runAsk(args: string[]): number {
  try {
    const [question, ...rest] = args
    if (question === 'inspect') console.log(compactJson(runInspect(rest)))
    else if (question === 'room') console.log(compactJson(runRoom(rest)))
    else
      throw new UsageError(
        question === undefined ? 'no question given' : `unknown question '${question}'`
      )
    return 0
  } catch (error) {
    if (error instanceof UsageError) {
      console.error(`chd: ${error.message}\n\n${ASK_USAGE}`)
      return 2
    }
    if (error instanceof Refused) {
      console.error(`chd: ${error.message}`)
      return 1
    }
    throw error
  }
}
