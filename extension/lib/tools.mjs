// The extension's tools as plain functions (ADR 0110), independent of the MCP
// transport so they can be tested directly. Each returns a JSON-able object (or
// a string) and throws ToolError for a refusal the assistant should read.
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync
} from 'node:fs'
import { randomUUID } from 'node:crypto'
import { basename, dirname, extname, join, posix, sep } from 'node:path'
import {
  createEmptyDiagram,
  parseDiagram,
  serializeDiagram
} from '../../src/shared/diagram/index.ts'
import { describeDiagram, layoutIssues, roomForLabel } from '../../src/shared/edit/inspect.ts'
import { applyOperations, OperationError } from '../../src/shared/edit/operations.ts'
import { metamodelFileBase } from '../../src/shared/conformance/metamodel.ts'
import {
  checkDiagramText,
  metamodelProblems,
  parseMetamodelText
} from '../../src/shared/conformance/report.ts'
import { compareDiagrams, diffToJson, notesBetween } from '../../src/shared/compare/report.ts'
// The same containment rule the command line applies to a stored note path (ADR 0115).
import { containedPath } from '../../src/main/containedPath.ts'
// The one place the extension starts another program: `git show <revision>:<file>`, read-only
// (ADR 0142).
import { buildGitSession } from '../../src/main/compare/gitCompare.ts'
import { validateFile } from '../../resources/ai/skills/chd-diagrams/scripts/validate_chd.mjs'
import {
  MAX_FILE_BYTES,
  METAMODEL_SUFFIX,
  ToolError,
  isDotOrIgnoredEntry,
  isMetamodelName,
  isReadBlockedName,
  isWritableName,
  mimeTypeOf,
  resolveInFolder
} from './fileRules.mjs'
import { FINGERPRINT_PATTERN, fingerprint } from './fingerprint.mjs'
import { formatSpec } from './formatSpec.mjs'
import { loadBuiltinMetamodels } from './metamodelsText.mjs'

const LIST_LIMIT = 300
const LIST_MAX_DEPTH = 8

function staleError(rel) {
  return new ToolError(
    `"${rel}" has changed since you read it, so it was not overwritten. Call read_file again and redo your edit on the new content.`
  )
}

function checkSize(content) {
  if (typeof content !== 'string') throw new ToolError('content must be text')
  if (Buffer.byteLength(content, 'utf-8') > MAX_FILE_BYTES) {
    throw new ToolError(`content is larger than the ${MAX_FILE_BYTES / (1024 * 1024)} MB limit`)
  }
}

function assertFile(absolute, rel) {
  if (!statSync(absolute).isFile()) throw new ToolError(`"${rel}" is not a file`)
}

// Validates a candidate .chd without a text-taking validator: it goes into a
// hidden temporary file beside the target (so relative paths resolve exactly as
// they will for the real file), which is removed whatever happens.
function validateCandidate(root, targetAbsolute, rel, content) {
  const temp = join(dirname(targetAbsolute), `.chd-validate-${randomUUID()}`)
  writeFileSync(temp, content, 'utf-8')
  try {
    return tidyValidation(root, validateFile(temp, false), temp, rel)
  } finally {
    rmSync(temp, { force: true })
  }
}

// Messages carry absolute paths: show diagram-relative ones instead.
function tidyValidation(root, { errors, warnings }, validatedPath, rel) {
  const tidy = (message) =>
    message
      .replaceAll(validatedPath, rel)
      .replaceAll(root + sep, '')
      .replaceAll(root, '.')
  return {
    ok: errors.length === 0,
    errors: errors.map(tidy),
    warnings: warnings.map(tidy)
  }
}

function refuseInvalid(rel, validation) {
  return new ToolError(
    `"${rel}" was not written because it has structural errors:\n${validation.errors.join('\n')}`
  )
}

// A metamodel is checked from its text, with the same reader `chd check` uses; it holds no relative
// paths, so unlike a diagram it needs no temporary file (ADR 0143).
function refuseInvalidMetamodel(rel, content) {
  const loaded = parseMetamodelText(content, basename(rel))
  if ('message' in loaded) {
    throw new ToolError(`"${rel}" was not written. ${loaded.message}`)
  }
}

export function createTools({ root, allowUpdate, specSources }) {
  const builtinMetamodels = loadBuiltinMetamodels()
  const madeHere = new Set()

  // The text of a file the assistant named, refused if it is too large or not UTF-8 text.
  function textOf(absolute, rel) {
    assertFile(absolute, rel)
    if (statSync(absolute).size > MAX_FILE_BYTES) {
      throw new ToolError(`"${rel}" is larger than the ${MAX_FILE_BYTES / (1024 * 1024)} MB limit`)
    }
    try {
      return new TextDecoder('utf-8', { fatal: true }).decode(readFileSync(absolute))
    } catch {
      throw new ToolError(`"${rel}" is not valid UTF-8 text`)
    }
  }

  // A .chd the assistant named, as { absolute, rel, text }.
  function diagramFile(path, tool) {
    const { absolute, relative: rel } = resolveInFolder(root, path, 'read', { mustExist: true })
    if (extname(absolute).toLowerCase() !== '.chd') {
      throw new ToolError(`${tool} only works on .chd diagram files`)
    }
    return { absolute, rel, text: textOf(absolute, rel) }
  }

  // A diagram given as a path in the folder, or as its text: the inline form judges a candidate
  // before it is written. Exactly one of the two. `names` are the argument names for the messages
  // and `label` is what an inline diagram is called in a result.
  function diagramInput({ path, content }, names, tool, label = '(inline)') {
    const hasPath = typeof path === 'string' && path.trim() !== ''
    const hasContent = content !== undefined
    if (hasPath && hasContent) {
      throw new ToolError(
        `give ${names.path} (a file in the folder) or ${names.content} (the diagram's text), not both`
      )
    }
    if (!hasPath && !hasContent) {
      throw new ToolError(`${names.path} or ${names.content} is required`)
    }
    if (!hasContent) return diagramFile(path, tool)
    if (typeof content !== 'string') throw new ToolError(`${names.content} must be text`)
    if (Buffer.byteLength(content, 'utf-8') > MAX_FILE_BYTES) {
      throw new ToolError(
        `${names.content} is larger than the ${MAX_FILE_BYTES / (1024 * 1024)} MB limit`
      )
    }
    return { absolute: null, rel: label, text: content, inline: true }
  }

  function parsed(file) {
    try {
      return parseDiagram(file.text)
    } catch (error) {
      throw new ToolError(`can't read '${file.rel}': ${error?.message ?? error}`)
    }
  }

  // Files the assistant may read, in the whole folder or under `subfolder`. A large tree hits the
  // cap, so the assistant can narrow the listing to one subfolder.
  function listFiles({ subfolder } = {}) {
    let start = root
    if (typeof subfolder === 'string' && subfolder.trim() !== '') {
      const found = resolveInFolder(root, subfolder, 'read', { mustExist: true })
      if (!statSync(found.absolute).isDirectory()) {
        throw new ToolError(`"${found.relative}" is not a folder`)
      }
      start = found.absolute
    }
    const files = []
    let truncated = false
    const walk = (dir, depth) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (isDotOrIgnoredEntry(entry.name) || entry.isSymbolicLink()) continue
        const full = join(dir, entry.name)
        if (entry.isDirectory()) {
          if (depth < LIST_MAX_DEPTH) walk(full, depth + 1)
          continue
        }
        if (!entry.isFile() || isReadBlockedName(entry.name)) continue
        if (files.length >= LIST_LIMIT) {
          truncated = true
          return
        }
        const stats = statSync(full)
        files.push({
          path: full
            .slice(root.length + 1)
            .split(sep)
            .join('/'),
          bytes: stats.size,
          modified: stats.mtime.toISOString(),
          writable: isWritableName(entry.name)
        })
      }
    }
    walk(start, 0)
    files.sort((a, b) => a.path.localeCompare(b.path))
    // The folder's name only, never its full path (which would go to the provider): enough for an
    // assistant to notice that the server points at the wrong folder.
    return { folder: basename(root), files, truncated, updatesEnabled: allowUpdate }
  }

  function getFormatSpec({ topic } = {}) {
    try {
      return formatSpec(specSources, topic)
    } catch (error) {
      throw new ToolError(error.message)
    }
  }

  function validateDiagram({ path }) {
    const { absolute, relative: rel } = resolveInFolder(root, path, 'read', { mustExist: true })
    if (extname(absolute).toLowerCase() !== '.chd') {
      throw new ToolError('validate_diagram only validates .chd diagram files')
    }
    assertFile(absolute, rel)
    return tidyValidation(root, validateFile(absolute, false), absolute, rel)
  }

  // `chd validate` on a metamodel file: the same list of problems, from the shared reader. A
  // metamodel under its old name (.chdprofile.json) is read too.
  function validateMetamodel({ path }) {
    const { absolute, relative: rel } = resolveInFolder(root, path, 'read', { mustExist: true })
    if (metamodelFileBase(rel) === null) {
      throw new ToolError('validate_metamodel only validates .chdmeta metamodel files')
    }
    const errors = metamodelProblems(textOf(absolute, rel))
    return { ok: errors.length === 0, errors, warnings: [] }
  }

  // `chd check` (ADR 0131): the same shared code, so the same result as `chd check --json` for one
  // file. A metamodel is a built-in one by name, or a .chdmeta file in the folder.
  function checkDiagram({ path, content, metamodel }) {
    const file = diagramInput(
      { path, content },
      { path: 'path', content: 'content' },
      'check_diagram'
    )
    const builtIn = Object.keys(builtinMetamodels)
    if (typeof metamodel !== 'string' || metamodel.trim() === '') {
      throw new ToolError(
        `metamodel is required: the name of a built-in metamodel (${builtIn.join(', ')}) or the path of a ${METAMODEL_SUFFIX} file in the folder`
      )
    }
    let metamodelText
    let metamodelName
    if (Object.hasOwn(builtinMetamodels, metamodel)) {
      metamodelText = builtinMetamodels[metamodel]
      metamodelName = metamodel + METAMODEL_SUFFIX
    } else {
      const unknown = new ToolError(
        `no metamodel called '${metamodel}': use a built-in metamodel (${builtIn.join(', ')}) or the path of a ${METAMODEL_SUFFIX} file in the folder`
      )
      let found
      try {
        found = resolveInFolder(root, metamodel, 'read', { mustExist: false })
      } catch {
        throw unknown
      }
      if (metamodelFileBase(found.relative) === null || !existsSync(found.absolute)) throw unknown
      metamodelText = textOf(found.absolute, found.relative)
      metamodelName = basename(found.relative)
    }
    const loaded = parseMetamodelText(metamodelText, metamodelName)
    if ('message' in loaded) throw new ToolError(loaded.message)
    parsed(file)
    return { file: file.rel, result: checkDiagramText(file.text, loaded.metamodel) }
  }

  // The text of a note beside a diagram, or null if it is not there or may not be read: a stored
  // path leaving the diagram's folder is never read (ADR 0115), and the folder rules still apply.
  function noteBeside(diagramAbsolute, stored) {
    const full = containedPath(dirname(diagramAbsolute), stored)
    return full === null ? null : noteOnDisk(full)
  }

  // `chd diff` (ADR 0137): the same shared code, so the same result as `chd diff --json`. The
  // earlier version is a second file in the folder, or the same file in git at a revision
  // (`chd diff <file> --rev`, ADR 0142).
  async function diffDiagrams({
    old_path: oldPath,
    old_content: oldContent,
    new_path: newPath,
    new_content: newContent,
    revision,
    match
  }) {
    const hasOldPath = typeof oldPath === 'string' && oldPath.trim() !== ''
    const earlier = [hasOldPath, oldContent !== undefined, revision !== undefined]
    if (earlier.filter(Boolean).length > 1) {
      throw new ToolError(
        'give only one of old_path (a second file), old_content (its text) and revision (the file in git)'
      )
    }
    const newer = diagramInput(
      { path: newPath, content: newContent },
      { path: 'new_path', content: 'new_content' },
      'diff_diagrams',
      'new content'
    )
    if (!earlier[0] && !earlier[1]) {
      if (newer.inline) {
        throw new ToolError(
          'new_content needs an earlier version to compare with: give old_path or old_content (a revision compares a file on disk with git)'
        )
      }
      return diffWithGit(newer, revision ?? 'HEAD', match === true)
    }
    const older = diagramInput(
      { path: oldPath, content: oldContent },
      { path: 'old_path', content: 'old_content' },
      'diff_diagrams',
      'old content'
    )
    const olderDiagram = parsed(older)
    const newerDiagram = parsed(newer)
    // Notes sit beside a file: a side given as text has none, and comparing one side's notes with
    // none would report every note as added or removed.
    const notes =
      older.inline || newer.inline
        ? {}
        : notesBetween(olderDiagram, newerDiagram, {
            before: (stored) => noteBeside(older.absolute, stored),
            after: (stored) => noteBeside(newer.absolute, stored)
          })
    return diffToJson(
      compareDiagrams(olderDiagram, newerDiagram, {
        olderName: older.rel,
        newerName: newer.rel,
        match: match === true,
        notes
      })
    )
  }

  // The file on disk against the same file at a git revision. Git is asked for that one file only,
  // and the note files on disk are read under the folder rules (ADR 0142).
  async function diffWithGit(newer, revision, match) {
    if (typeof revision !== 'string') throw new ToolError('revision must be text')
    const result = await buildGitSession(newer.absolute, revision, {
      allowed: noteMayBeRead,
      read: noteOnDisk
    })
    if (!result.ok) throw new ToolError(result.message)
    const { base, next, notesContent } = result.session
    const name = basename(newer.rel)
    return diffToJson(
      compareDiagrams(base, next, {
        olderName: `${name} at ${revision}`,
        newerName: `${name} on disk`,
        match,
        notes: notesContent ?? {}
      })
    )
  }

  // Whether the folder rules allow reading a note at all, whether or not it exists now (git may
  // still have it).
  function noteMayBeRead(absolute) {
    try {
      resolveInFolder(root, absolute, 'read', { mustExist: false })
      return true
    } catch {
      return false
    }
  }

  // A note on disk under the folder rules, or null.
  function noteOnDisk(absolute) {
    try {
      const found = resolveInFolder(root, absolute, 'read', { mustExist: true })
      return textOf(found.absolute, found.relative)
    } catch {
      return null
    }
  }

  function readFile({ path }) {
    const { absolute, relative: rel } = resolveInFolder(root, path, 'read', { mustExist: true })
    assertFile(absolute, rel)
    if (statSync(absolute).size > MAX_FILE_BYTES) {
      throw new ToolError(`"${rel}" is larger than the ${MAX_FILE_BYTES / (1024 * 1024)} MB limit`)
    }
    const bytes = readFileSync(absolute)
    // Text is returned as text; anything else (a PDF, a picture, a spreadsheet, text in another
    // encoding) as base64 for the server layer to hand on in the form MCP allows. What the
    // assistant can make of it is up to the client and the model.
    let content = null
    if (!bytes.includes(0)) {
      try {
        content = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
      } catch {
        content = null
      }
    }
    if (content !== null) {
      return { path: rel, content, fingerprint: fingerprint(bytes), bytes: bytes.length }
    }
    return {
      path: rel,
      binary: true,
      mimeType: mimeTypeOf(rel),
      fingerprint: fingerprint(bytes),
      bytes: bytes.length,
      data: bytes.toString('base64')
    }
  }

  function createFile({ path, content }) {
    const { absolute, relative: rel } = resolveInFolder(root, path, 'write', { mustExist: false })
    checkSize(content)
    if (existsSync(absolute)) {
      throw new ToolError(
        `"${rel}" already exists, so it was not overwritten. Choose another name${allowUpdate ? ', or read it and use update_file' : ''}.`
      )
    }
    // First folder this call creates, so a refused create leaves no empty folders behind.
    const createdDir = mkdirSync(dirname(absolute), { recursive: true })
    try {
      let warnings = []
      if (extname(absolute).toLowerCase() === '.chd') {
        const validation = validateCandidate(root, absolute, rel, content)
        if (!validation.ok) throw refuseInvalid(rel, validation)
        warnings = validation.warnings
      } else if (isMetamodelName(absolute)) {
        refuseInvalidMetamodel(rel, content)
      }
      try {
        // 'wx' is an exclusive create: it fails if the file appeared meanwhile.
        writeFileSync(absolute, content, { encoding: 'utf-8', flag: 'wx' })
      } catch (error) {
        if (error.code === 'EEXIST') {
          throw new ToolError(`"${rel}" already exists, so it was not overwritten.`)
        }
        throw error
      }
      if (extname(absolute).toLowerCase() === '.chd') madeHere.add(rel)
      return {
        path: rel,
        fingerprint: fingerprint(readFileSync(absolute)),
        warnings
      }
    } catch (error) {
      if (createdDir) rmSync(createdDir, { recursive: true, force: true })
      throw error
    }
  }

  function updateFile(args) {
    if (!allowUpdate) {
      throw new ToolError(
        'Updating existing files is turned off for this extension. The user can enable "Allow Claude to modify existing files" in the extension settings; until then use create_file with a new name.'
      )
    }
    return replaceFile(args)
  }

  function replaceFile({ path, content, base_fingerprint: baseFingerprint }) {
    const { absolute, relative: rel } = resolveInFolder(root, path, 'write', { mustExist: true })
    assertFile(absolute, rel)
    checkSize(content)
    if (typeof baseFingerprint !== 'string' || !FINGERPRINT_PATTERN.test(baseFingerprint)) {
      throw new ToolError(
        'base_fingerprint is required: pass the fingerprint that read_file (or your last create_file/update_file) returned for this file.'
      )
    }
    if (fingerprint(readFileSync(absolute)) !== baseFingerprint) throw staleError(rel)

    // Written beside the target, then renamed over it: a crash can never leave
    // a half-written diagram.
    const temp = join(dirname(absolute), `.chd-write-${randomUUID()}`)
    writeFileSync(temp, content, 'utf-8')
    try {
      let warnings = []
      if (extname(absolute).toLowerCase() === '.chd') {
        const validation = tidyValidation(root, validateFile(temp, false), temp, rel)
        if (!validation.ok) throw refuseInvalid(rel, validation)
        warnings = validation.warnings
      } else if (isMetamodelName(absolute)) {
        refuseInvalidMetamodel(rel, content)
      }
      // Checked again right before replacing; the instant between this and the
      // rename is the one race left (ADR 0110).
      if (fingerprint(readFileSync(absolute)) !== baseFingerprint) throw staleError(rel)
      renameSync(temp, absolute)
      return { path: rel, fingerprint: fingerprint(readFileSync(absolute)), warnings }
    } finally {
      rmSync(temp, { force: true })
    }
  }

  // --- building a diagram step by step (epic 0165): operations that answer with what they made,
  // and questions about room and layout. The shared core is src/shared/edit.

  function issueLines(diagram) {
    const issues = layoutIssues(diagram, diagram.fontFamily)
    const shown = issues.slice(0, 12).map((issue) => issue.message)
    if (issues.length > shown.length) shown.push(`${issues.length - shown.length} more`)
    return shown
  }

  function loadDiagram(absolute, rel) {
    try {
      return parseDiagram(textOf(absolute, rel))
    } catch (error) {
      if (error instanceof ToolError) throw error
      throw new ToolError(`"${rel}" is not a valid .chd diagram: ${error.message}`)
    }
  }

  function editDiagram({ path, operations, base_fingerprint: baseFingerprint }) {
    if (!Array.isArray(operations) || operations.length === 0) {
      throw new ToolError('operations must be a list with at least one operation')
    }
    if (operations.length > 200) throw new ToolError('at most 200 operations in one call')
    const { absolute, relative: rel } = resolveInFolder(root, path, 'write', { mustExist: false })
    if (extname(absolute).toLowerCase() !== '.chd')
      throw new ToolError('edit_diagram works on .chd files')
    const exists = existsSync(absolute)
    let diagram
    if (exists) {
      assertFile(absolute, rel)
      if (!allowUpdate && !madeHere.has(rel)) {
        throw new ToolError(
          `"${rel}" already exists and was not made in this session. Changing existing files is turned off for this extension (the user can enable "Allow Claude to modify existing files"). You can keep editing a diagram you created yourself in this session.`
        )
      }
      if (typeof baseFingerprint !== 'string' || !FINGERPRINT_PATTERN.test(baseFingerprint)) {
        throw new ToolError(
          'base_fingerprint is required for a diagram that exists: pass the fingerprint from your last edit_diagram or inspect_diagram answer (or read_file) for it.'
        )
      }
      if (fingerprint(readFileSync(absolute)) !== baseFingerprint) throw staleError(rel)
      diagram = loadDiagram(absolute, rel)
    } else {
      if (baseFingerprint !== undefined) {
        throw new ToolError(
          `"${rel}" does not exist yet, so there is no fingerprint to pass: leave base_fingerprint out and the diagram is created.`
        )
      }
      diagram = createEmptyDiagram()
    }
    // Paths the operations store in the diagram (a link, a note) are relative to it; they may only
    // lead to places this extension may use (ADR 0115).
    const here = posix.dirname(rel)
    const inFolder = (stored) => posix.join(here, stored)
    let applied
    try {
      applied = applyOperations(diagram, operations, {
        newId: (prefix) => `${prefix}-${randomUUID()}`,
        notesFolder: `${posix.basename(rel, extname(rel))}/notes`,
        checkReference: (stored) => {
          try {
            resolveInFolder(root, inFolder(stored), 'read', { mustExist: false })
            return undefined
          } catch (error) {
            if (error instanceof ToolError) return `"${stored}": ${error.message}`
            throw error
          }
        }
      })
    } catch (error) {
      if (error instanceof OperationError) {
        throw new ToolError(
          `${error.message}. Nothing was changed; fix it and send the whole list again.`
        )
      }
      throw error
    }
    const content = serializeDiagram(applied.diagram)
    // New notes first, each created and never overwritten; if the diagram is then refused (a stale
    // fingerprint, an invalid result) the notes made for it are removed again.
    const madeNotes = []
    const madeDirs = []
    let written
    try {
      for (const note of applied.files) {
        const target = inFolder(note.path)
        const { absolute } = resolveInFolder(root, target, 'write', { mustExist: false })
        const firstNew = mkdirSync(dirname(absolute), { recursive: true })
        if (firstNew) madeDirs.push(firstNew)
        createFile({ path: target, content: note.content })
        madeNotes.push(absolute)
      }
      written = exists
        ? replaceFile({ path: rel, content, base_fingerprint: baseFingerprint })
        : createFile({ path: rel, content })
    } catch (error) {
      for (const file of madeNotes) rmSync(file, { force: true })
      for (const dir of madeDirs) rmSync(dir, { recursive: true, force: true })
      throw error
    }
    return {
      path: rel,
      fingerprint: written.fingerprint,
      results: applied.results,
      issues: issueLines(applied.diagram),
      warnings: written.warnings
    }
  }

  const INSPECT_LIMIT = 400

  function inspectDiagram({ path }) {
    const { absolute, relative: rel } = resolveInFolder(root, path, 'read', { mustExist: true })
    const diagram = loadDiagram(absolute, rel)
    const { nodes, edges, ...catalogs } = describeDiagram(diagram)
    const truncated = nodes.length > INSPECT_LIMIT || edges.length > INSPECT_LIMIT
    return {
      path: rel,
      fingerprint: fingerprint(readFileSync(absolute)),
      ...catalogs,
      nodes: nodes.slice(0, INSPECT_LIMIT),
      edges: edges.slice(0, INSPECT_LIMIT),
      ...(truncated
        ? { truncated: `only the first ${INSPECT_LIMIT} nodes and edges are listed` }
        : {}),
      issues: issueLines(diagram)
    }
  }

  function roomForLabelTool(question) {
    if (typeof question.label !== 'string') throw new ToolError('label must be text')
    if (question.direction !== 'horizontal' && question.direction !== 'vertical') {
      throw new ToolError(
        'direction must be "horizontal" (side by side) or "vertical" (one above the other)'
      )
    }
    return roomForLabel(question)
  }

  return {
    edit_diagram: editDiagram,
    inspect_diagram: inspectDiagram,
    room_for_label: roomForLabelTool,
    list_files: listFiles,
    get_format_spec: getFormatSpec,
    validate_diagram: validateDiagram,
    validate_metamodel: validateMetamodel,
    check_diagram: checkDiagram,
    diff_diagrams: diffDiagrams,
    read_file: readFile,
    create_file: createFile,
    update_file: updateFile
  }
}
